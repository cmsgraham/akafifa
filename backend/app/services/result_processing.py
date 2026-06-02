"""Match result processing — orchestrates scoring, duel resolution, and cache invalidation."""

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import (
    AuditLog,
    DuelChallenge,
    Match,
    MatchResult,
    Prediction,
    UserProfile,
)
from app.services.scoring import DEFAULT_CONFIG, calculate_points


async def process_match_result(match_id: UUID, db: AsyncSession) -> None:
    """Process all predictions for a confirmed match.

    Steps (per design document Section 12.1):
    1. Fetch all predictions for the match
    2. For each prediction, call calculate_points()
    3. Write points and result_type to the predictions row
    4. Upsert user_profiles.total_points, exact_hits, outcome_hits
    5. Resolve all accepted duels for this match
    6. (Future) Resolve automatic flash challenges
    7. Invalidate Redis leaderboard cache
    8. Enqueue notification jobs
    9. Append audit_logs entry
    """
    # Fetch match result
    result = await db.execute(
        select(MatchResult).where(MatchResult.match_id == match_id)
    )
    match_result = result.scalar_one_or_none()
    if not match_result:
        return

    actual_home = match_result.home_score
    actual_away = match_result.away_score

    # Step 1: Fetch all predictions
    pred_result = await db.execute(
        select(Prediction).where(Prediction.match_id == match_id)
    )
    predictions = list(pred_result.scalars().all())

    # Steps 2–4: Score each prediction
    for pred in predictions:
        scoring = calculate_points(
            pred.home_score, pred.away_score, actual_home, actual_away, DEFAULT_CONFIG
        )

        # Idempotency check: skip if unchanged
        if pred.points == scoring.points and pred.result_type == scoring.result_type:
            continue

        old_points = pred.points or 0
        old_type = pred.result_type

        pred.points = scoring.points
        pred.result_type = scoring.result_type

        # Update user profile aggregates
        profile_result = await db.execute(
            select(UserProfile).where(UserProfile.user_id == pred.user_id)
        )
        profile = profile_result.scalar_one_or_none()
        if profile:
            # Remove old contribution, add new
            if old_type == "exact":
                profile.exact_hits = max(0, profile.exact_hits - 1)
            elif old_type == "outcome":
                profile.outcome_hits = max(0, profile.outcome_hits - 1)

            profile.total_points = profile.total_points - old_points + scoring.points

            if scoring.result_type == "exact":
                profile.exact_hits += 1
            elif scoring.result_type == "outcome":
                profile.outcome_hits += 1

    # Step 5: Resolve duels
    await _resolve_duels(match_id, actual_home, actual_away, db)

    # Step 9: Audit log
    audit = AuditLog(
        action="process_match_result",
        resource_type="match",
        resource_id=match_id,
        after_state={"home_score": actual_home, "away_score": actual_away},
    )
    db.add(audit)


async def _resolve_duels(
    match_id: UUID, actual_home: int, actual_away: int, db: AsyncSession
) -> None:
    """Resolve all active duels for a match with escrow payout."""
    from datetime import datetime, timezone
    from sqlalchemy import update

    duel_result = await db.execute(
        select(DuelChallenge).where(
            DuelChallenge.match_id == match_id,
            DuelChallenge.status == "active",
        )
    )
    duels = list(duel_result.scalars().all())
    now = datetime.now(timezone.utc)

    for duel in duels:
        # Fetch predictions for both players
        challenger_pred = await _get_prediction(duel.challenger_id, match_id, db)
        opponent_pred = await _get_prediction(duel.opponent_id, match_id, db)

        c_points = 0
        o_points = 0
        if challenger_pred:
            c_scoring = calculate_points(
                challenger_pred.home_score, challenger_pred.away_score,
                actual_home, actual_away,
            )
            c_points = c_scoring.points
        if opponent_pred:
            o_scoring = calculate_points(
                opponent_pred.home_score, opponent_pred.away_score,
                actual_home, actual_away,
            )
            o_points = o_scoring.points

        duel.challenger_score = c_points
        duel.opponent_score = o_points
        duel.resolved_at = now
        duel.status = "completed"
        stake = duel.stake_points

        if c_points > o_points:
            duel.winner_id = duel.challenger_id
            await db.execute(
                update(UserProfile).where(UserProfile.user_id == duel.challenger_id)
                .values(duel_points_balance=UserProfile.duel_points_balance + 2 * stake)
            )
        elif o_points > c_points:
            duel.winner_id = duel.opponent_id
            await db.execute(
                update(UserProfile).where(UserProfile.user_id == duel.opponent_id)
                .values(duel_points_balance=UserProfile.duel_points_balance + 2 * stake)
            )
        else:
            duel.winner_id = None
            # Tie: refund both
            await db.execute(
                update(UserProfile).where(UserProfile.user_id == duel.challenger_id)
                .values(duel_points_balance=UserProfile.duel_points_balance + stake)
            )
            await db.execute(
                update(UserProfile).where(UserProfile.user_id == duel.opponent_id)
                .values(duel_points_balance=UserProfile.duel_points_balance + stake)
            )

        # Update profile counters
        await _update_duel_counters(duel, db)


async def _get_prediction(
    user_id: UUID, match_id: UUID, db: AsyncSession
) -> Prediction | None:
    result = await db.execute(
        select(Prediction).where(
            Prediction.user_id == user_id,
            Prediction.match_id == match_id,
        )
    )
    return result.scalar_one_or_none()


async def _update_duel_counters(duel: DuelChallenge, db: AsyncSession) -> None:
    """Increment win/loss/draw counters on both user_profiles."""
    for uid in [duel.challenger_id, duel.opponent_id]:
        profile_result = await db.execute(
            select(UserProfile).where(UserProfile.user_id == uid)
        )
        profile = profile_result.scalar_one_or_none()
        if not profile:
            continue

        if duel.winner_id is None:
            profile.duel_draws += 1
        elif duel.winner_id == uid:
            profile.duel_wins += 1
        else:
            profile.duel_losses += 1
