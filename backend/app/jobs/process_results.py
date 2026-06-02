"""Process results for confirmed matches — score predictions and resolve duels with escrow."""

import asyncio
import logging
from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import async_session
from app.db.models import (
    DuelChallenge,
    Match,
    MatchResult,
    Prediction,
    UserProfile,
)
from app.services.scoring import calculate_points
from app.services.notifications import notify, NotifType

logger = logging.getLogger(__name__)


async def _process(match_id_str: str) -> dict:
    """Score all predictions for a match and resolve active duels with escrow payout."""
    match_id = UUID(match_id_str)
    summary = {"predictions_scored": 0, "duels_resolved": 0}

    async with async_session() as db:
        # 1. Load match result
        mr = (await db.execute(
            select(MatchResult).where(MatchResult.match_id == match_id)
        )).scalar_one_or_none()
        if not mr:
            logger.warning("No result for match %s, skipping", match_id)
            return summary

        actual_home = mr.home_score
        actual_away = mr.away_score

        # 2. Score all predictions for this match (idempotent)
        predictions = (await db.execute(
            select(Prediction).where(Prediction.match_id == match_id)
        )).scalars().all()

        for pred in predictions:
            result = calculate_points(
                pred.home_score, pred.away_score,
                actual_home, actual_away,
            )
            pred.points = result.points
            pred.result_type = result.result_type

        summary["predictions_scored"] = len(predictions)
        logger.info("Scored %d predictions for match %s", len(predictions), match_id)

        # 3. Build user points map for this match
        user_points: dict[UUID, tuple[int, str]] = {}
        for pred in predictions:
            user_points[pred.user_id] = (pred.points or 0, pred.result_type or "miss")

        # 3b. Bulk recalculate prediction totals for affected users
        affected_user_ids = list(user_points.keys())
        for uid in affected_user_ids:
            all_preds = (await db.execute(
                select(Prediction.points, Prediction.result_type)
                .where(Prediction.user_id == uid, Prediction.points.isnot(None))
            )).all()
            total = sum(p.points for p in all_preds)
            exact = sum(1 for p in all_preds if p.result_type == "exact")
            outcome = sum(1 for p in all_preds if p.result_type == "outcome")

            await db.execute(
                update(UserProfile)
                .where(UserProfile.user_id == uid)
                .values(total_points=total, exact_hits=exact, outcome_hits=outcome)
            )

        # 3c. Notify users their predictions have been scored
        match_obj = (await db.execute(select(Match).where(Match.id == match_id))).scalar_one_or_none()
        for pred in predictions:
            pts = pred.points or 0
            rtype = pred.result_type or "miss"
            if rtype == "exact":
                msg = f"Exact score! You earned {pts} points."
            elif rtype == "outcome":
                msg = f"Correct outcome! You earned {pts} points."
            else:
                msg = "No points this time. Better luck next match!"
            await notify(
                db,
                user_id=pred.user_id,
                type=NotifType.PREDICTION_SCORED,
                title="Prediction Scored",
                message=msg,
                related_entity_type="match",
                related_entity_id=match_id,
                action_url=f"/matches/{match_id}",
                dedup_key=f"pred_scored:{match_id}:{pred.user_id}",
                data={"points": pts, "result_type": rtype},
            )

        # 4. Resolve active duels for this match (escrow payout)
        duels = (await db.execute(
            select(DuelChallenge).where(
                DuelChallenge.match_id == match_id,
                DuelChallenge.status == "active",
            )
        )).scalars().all()

        now = datetime.now(timezone.utc)
        duel_user_ids = set()

        for duel in duels:
            challenger_pts = user_points.get(duel.challenger_id, (0, "miss"))[0]
            opponent_pts = user_points.get(duel.opponent_id, (0, "miss"))[0]
            stake = duel.stake_points

            duel.challenger_score = challenger_pts
            duel.opponent_score = opponent_pts
            duel.resolved_at = now
            duel.status = "completed"

            if challenger_pts > opponent_pts:
                duel.winner_id = duel.challenger_id
                # Winner gets full pot (2 × stake)
                await db.execute(
                    update(UserProfile)
                    .where(UserProfile.user_id == duel.challenger_id)
                    .values(duel_points_balance=UserProfile.duel_points_balance + 2 * stake)
                )
            elif opponent_pts > challenger_pts:
                duel.winner_id = duel.opponent_id
                await db.execute(
                    update(UserProfile)
                    .where(UserProfile.user_id == duel.opponent_id)
                    .values(duel_points_balance=UserProfile.duel_points_balance + 2 * stake)
                )
            else:
                # Tie: refund both
                duel.winner_id = None
                await db.execute(
                    update(UserProfile)
                    .where(UserProfile.user_id == duel.challenger_id)
                    .values(duel_points_balance=UserProfile.duel_points_balance + stake)
                )
                await db.execute(
                    update(UserProfile)
                    .where(UserProfile.user_id == duel.opponent_id)
                    .values(duel_points_balance=UserProfile.duel_points_balance + stake)
                )

            duel_user_ids.add(duel.challenger_id)
            duel_user_ids.add(duel.opponent_id)

            # Notify both duel participants
            if challenger_pts > opponent_pts:
                await notify(db, user_id=duel.challenger_id, type=NotifType.DUEL_WON,
                             title="Duel Won!", message=f"You won {stake * 2} points!",
                             related_entity_type="duel", related_entity_id=duel.id,
                             action_url="/duels", dedup_key=f"duel_result:{duel.id}:{duel.challenger_id}")
                await notify(db, user_id=duel.opponent_id, type=NotifType.DUEL_LOST,
                             title="Duel Lost", message=f"You lost {stake} points.",
                             related_entity_type="duel", related_entity_id=duel.id,
                             action_url="/duels", dedup_key=f"duel_result:{duel.id}:{duel.opponent_id}")
            elif opponent_pts > challenger_pts:
                await notify(db, user_id=duel.opponent_id, type=NotifType.DUEL_WON,
                             title="Duel Won!", message=f"You won {stake * 2} points!",
                             related_entity_type="duel", related_entity_id=duel.id,
                             action_url="/duels", dedup_key=f"duel_result:{duel.id}:{duel.opponent_id}")
                await notify(db, user_id=duel.challenger_id, type=NotifType.DUEL_LOST,
                             title="Duel Lost", message=f"You lost {stake} points.",
                             related_entity_type="duel", related_entity_id=duel.id,
                             action_url="/duels", dedup_key=f"duel_result:{duel.id}:{duel.challenger_id}")
            else:
                await notify(db, user_id=duel.challenger_id, type=NotifType.DUEL_DRAW,
                             title="Duel Draw", message=f"It's a draw! Your {stake} points were refunded.",
                             related_entity_type="duel", related_entity_id=duel.id,
                             action_url="/duels", dedup_key=f"duel_result:{duel.id}:{duel.challenger_id}")
                await notify(db, user_id=duel.opponent_id, type=NotifType.DUEL_DRAW,
                             title="Duel Draw", message=f"It's a draw! Your {stake} points were refunded.",
                             related_entity_type="duel", related_entity_id=duel.id,
                             action_url="/duels", dedup_key=f"duel_result:{duel.id}:{duel.opponent_id}")

        summary["duels_resolved"] = len(duels)
        logger.info("Resolved %d duels for match %s", len(duels), match_id)

        # 5. Update duel win/loss/draw counters for affected users
        for uid in duel_user_ids:
            all_duels = (await db.execute(
                select(DuelChallenge).where(
                    DuelChallenge.status == "completed",
                    (DuelChallenge.challenger_id == uid) | (DuelChallenge.opponent_id == uid),
                )
            )).scalars().all()

            wins = sum(1 for d in all_duels if d.winner_id == uid)
            losses = sum(1 for d in all_duels if d.winner_id is not None and d.winner_id != uid)
            draws = sum(1 for d in all_duels if d.winner_id is None)

            await db.execute(
                update(UserProfile)
                .where(UserProfile.user_id == uid)
                .values(duel_wins=wins, duel_losses=losses, duel_draws=draws)
            )

        await db.commit()

    logger.info("Process results complete for match %s: %s", match_id, summary)
    return summary


def run(match_id: str) -> None:
    """Entry point for the background job (called by rq worker)."""
    logger.info("Processing results for match %s", match_id)
    asyncio.run(_process(match_id))
    logger.info("Result processing complete for match %s", match_id)
