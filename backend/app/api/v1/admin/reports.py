"""Admin reports — user point audit and app analytics."""

from datetime import datetime, timezone, timedelta
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select, case, and_, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import require_admin
from app.db.models import (
    AppSetting,
    AuditLog,
    Comment,
    CommentReaction,
    DuelChallenge,
    FlashChallenge,
    FlashChallengeAnswer,
    InAppNotification,
    Match,
    MatchResult,
    Notification,
    Notification,
    PointsLedger,
    Prediction,
    User,
    Team,
    UserFollow,
    UserProfile,
)
from app.db.session import get_db

router = APIRouter(prefix="/api/admin/reports", tags=["admin-reports"])
# Welcome bonus minted into UserProfile.total_points at registration (see
# /api/auth/register/verify). It is NOT recorded in points_ledger, so the
# audit must subtract it before comparing the profile balance to prediction
# scoring totals; otherwise every new user falsely flags as MISMATCH.
WELCOME_BONUS_POINTS = 10

# ── User Point Audit ─────────────────────────────────────────────────────────

@router.get("/user-audit/{user_id}")
async def user_point_audit(
    user_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    admin: Annotated[User, Depends(require_admin)],
):
    """Full point audit for a user: predictions, challenges, duels, ledger."""
    # User profile
    profile = (await db.execute(
        select(UserProfile).where(UserProfile.user_id == user_id)
    )).scalar_one_or_none()
    if not profile:
        raise HTTPException(status_code=404, detail="User not found")

    user = (await db.execute(select(User).where(User.id == user_id))).scalar_one_or_none()

    # Prediction breakdown
    predictions = (await db.execute(
        select(Prediction).where(Prediction.user_id == user_id).order_by(Prediction.submitted_at.desc())
    )).scalars().all()

    scored_preds = [p for p in predictions if p.points is not None]
    prediction_total = sum(p.points for p in scored_preds)
    exact_count = sum(1 for p in scored_preds if p.result_type == "exact")
    outcome_count = sum(1 for p in scored_preds if p.result_type == "outcome")
    miss_count = sum(1 for p in scored_preds if p.result_type == "miss")

    # Challenge answers
    answers = (await db.execute(
        select(FlashChallengeAnswer).where(FlashChallengeAnswer.user_id == user_id)
    )).scalars().all()

    # Duels
    duels_as_challenger = (await db.execute(
        select(DuelChallenge).where(DuelChallenge.challenger_id == user_id)
    )).scalars().all()
    duels_as_opponent = (await db.execute(
        select(DuelChallenge).where(DuelChallenge.opponent_id == user_id)
    )).scalars().all()

    # Ledger entries
    ledger = (await db.execute(
        select(PointsLedger)
        .where(PointsLedger.user_id == user_id)
        .order_by(PointsLedger.created_at.desc())
    )).scalars().all()

    # Compute expected balances from ledger
    ledger_challenge_total = sum(e.points_delta for e in ledger if e.transaction_type.startswith("challenge_"))
    ledger_duel_total = sum(e.points_delta for e in ledger if e.transaction_type.startswith("duel_"))

    return {
        "user": {
            "id": str(user_id),
            "email": user.email if user else None,
            "display_name": profile.display_name,
        },
        "profile_balances": {
            "total_points": profile.total_points,
            "challenge_points_balance": profile.challenge_points_balance,
            "duel_points_balance": profile.duel_points_balance,
            "exact_hits": profile.exact_hits,
            "outcome_hits": profile.outcome_hits,
            "duel_wins": profile.duel_wins,
            "duel_losses": profile.duel_losses,
            "duel_draws": profile.duel_draws,
            "composite_total": profile.total_points + profile.challenge_points_balance + profile.duel_points_balance,
        },
        "predictions": {
            "total_submitted": len(predictions),
            "scored": len(scored_preds),
            "unscored": len(predictions) - len(scored_preds),
            "exact_count": exact_count,
            "outcome_count": outcome_count,
            "miss_count": miss_count,
            "prediction_points_total": prediction_total,
            "welcome_bonus": WELCOME_BONUS_POINTS,
            "matches_profile_total": profile.total_points == prediction_total + WELCOME_BONUS_POINTS,
        },
        "challenges": {
            "answers_submitted": len(answers),
            "ledger_challenge_net": ledger_challenge_total,
            "matches_profile_balance": profile.challenge_points_balance == ledger_challenge_total,
        },
        "duels": {
            "as_challenger": len(duels_as_challenger),
            "as_opponent": len(duels_as_opponent),
            "ledger_duel_net": ledger_duel_total,
            "matches_profile_balance": profile.duel_points_balance == ledger_duel_total,
        },
        "ledger": [
            {
                "id": str(e.id),
                "type": e.transaction_type,
                "delta": e.points_delta,
                "balance_after": e.balance_after,
                "reference_type": e.reference_type,
                "reference_id": str(e.reference_id) if e.reference_id else None,
                "metadata": e.metadata_json,
                "created_at": e.created_at.isoformat(),
            }
            for e in ledger
        ],
        "integrity": {
            "prediction_points_ok": profile.total_points == prediction_total + WELCOME_BONUS_POINTS,
            "challenge_balance_ok": profile.challenge_points_balance == ledger_challenge_total,
            "duel_balance_ok": profile.duel_points_balance == ledger_duel_total,
            "exact_hits_ok": profile.exact_hits == exact_count,
            "outcome_hits_ok": profile.outcome_hits == outcome_count,
        },
    }


# ── All Users Audit Summary ─────────────────────────────────────────────────

@router.get("/users-audit")
async def all_users_audit_summary(
    db: Annotated[AsyncSession, Depends(get_db)],
    admin: Annotated[User, Depends(require_admin)],
):
    """Summary audit for all users — quick integrity check."""
    profiles = (await db.execute(
        select(UserProfile, User.email)
        .join(User, User.id == UserProfile.user_id)
        .order_by(UserProfile.total_points.desc())
    )).all()

    users = []
    for profile, email in profiles:
        # Quick prediction total check
        pred_sum = (await db.execute(
            select(func.coalesce(func.sum(Prediction.points), 0))
            .where(Prediction.user_id == profile.user_id, Prediction.points.isnot(None))
        )).scalar()

        ledger_challenge = (await db.execute(
            select(func.coalesce(func.sum(PointsLedger.points_delta), 0))
            .where(
                PointsLedger.user_id == profile.user_id,
                PointsLedger.transaction_type.like("challenge_%"),
            )
        )).scalar()

        ledger_duel = (await db.execute(
            select(func.coalesce(func.sum(PointsLedger.points_delta), 0))
            .where(
                PointsLedger.user_id == profile.user_id,
                PointsLedger.transaction_type.like("duel_%"),
            )
        )).scalar()

        users.append({
            "user_id": str(profile.user_id),
            "email": email,
            "display_name": profile.display_name,
            "total_points": profile.total_points,
            "challenge_balance": profile.challenge_points_balance,
            "duel_balance": profile.duel_points_balance,
            "composite": profile.total_points + profile.challenge_points_balance + profile.duel_points_balance,
            "integrity": {
                "predictions_ok": profile.total_points == pred_sum + WELCOME_BONUS_POINTS,
                "challenges_ok": profile.challenge_points_balance == ledger_challenge,
                "duels_ok": profile.duel_points_balance == ledger_duel,
            },
        })

    return {"data": users, "total": len(users)}


# ── App Analytics / Engagement ───────────────────────────────────────────────

@router.get("/analytics")
async def app_analytics(
    db: Annotated[AsyncSession, Depends(get_db)],
    admin: Annotated[User, Depends(require_admin)],
    days: int = Query(30, ge=1, le=365, description="Lookback window in days"),
):
    """App-wide engagement analytics: registrations, predictions, social, challenges, duels."""
    now = datetime.now(timezone.utc)
    since = now - timedelta(days=days)

    # ── Users ──
    total_users = (await db.execute(select(func.count(User.id)))).scalar()
    active_users = (await db.execute(
        select(func.count(User.id)).where(User.is_active == True)
    )).scalar()
    new_registrations = (await db.execute(
        select(func.count(User.id)).where(User.created_at >= since)
    )).scalar()

    # Registration trend (per day)
    reg_trend = (await db.execute(
        select(
            func.date_trunc("day", User.created_at).label("day"),
            func.count(User.id).label("count"),
        )
        .where(User.created_at >= since)
        .group_by(text("1"))
        .order_by(text("1"))
    )).all()

    # ── Predictions ──
    total_predictions = (await db.execute(select(func.count(Prediction.id)))).scalar()
    recent_predictions = (await db.execute(
        select(func.count(Prediction.id)).where(Prediction.submitted_at >= since)
    )).scalar()
    users_with_predictions = (await db.execute(
        select(func.count(func.distinct(Prediction.user_id)))
    )).scalar()

    # ── Social: Posts & Reactions ──
    total_posts = (await db.execute(select(func.count(Comment.id)))).scalar()
    recent_posts = (await db.execute(
        select(func.count(Comment.id)).where(Comment.created_at >= since)
    )).scalar()
    unique_posters = (await db.execute(
        select(func.count(func.distinct(Comment.user_id))).where(Comment.created_at >= since)
    )).scalar()
    total_reactions = (await db.execute(select(func.count(CommentReaction.id)))).scalar()
    recent_reactions = (await db.execute(
        select(func.count(CommentReaction.id)).where(CommentReaction.created_at >= since)
    )).scalar()

    # ── Follows ──
    total_follows = (await db.execute(select(func.count(UserFollow.id)))).scalar()
    recent_follows = (await db.execute(
        select(func.count(UserFollow.id)).where(UserFollow.created_at >= since)
    )).scalar()

    # ── Challenges ──
    total_challenges = (await db.execute(select(func.count(FlashChallenge.id)))).scalar()
    total_challenge_answers = (await db.execute(select(func.count(FlashChallengeAnswer.id)))).scalar()
    recent_challenge_answers = (await db.execute(
        select(func.count(FlashChallengeAnswer.id)).where(FlashChallengeAnswer.submitted_at >= since)
    )).scalar()

    # ── Duels ──
    total_duels = (await db.execute(select(func.count(DuelChallenge.id)))).scalar()
    recent_duels = (await db.execute(
        select(func.count(DuelChallenge.id)).where(DuelChallenge.created_at >= since)
    )).scalar()
    duel_status_breakdown = dict((await db.execute(
        select(DuelChallenge.status, func.count(DuelChallenge.id))
        .group_by(DuelChallenge.status)
    )).all())

    # ── Matches ──
    total_matches = (await db.execute(select(func.count(Match.id)))).scalar()
    confirmed_matches = (await db.execute(
        select(func.count(Match.id)).where(Match.status.in_(["finished", "confirmed"]))
    )).scalar()

    # ── Notifications ──
    total_notifications = (await db.execute(select(func.count(InAppNotification.id)))).scalar()
    read_notifications = (await db.execute(
        select(func.count(InAppNotification.id)).where(InAppNotification.status == "read")
    )).scalar()
    emails_sent = (await db.execute(
        select(func.count(Notification.id)).where(Notification.status == "sent")
    )).scalar()

    # ── Daily activity trend (posts + predictions in period) ──
    activity_trend = (await db.execute(
        select(
            func.date_trunc("day", Comment.created_at).label("day"),
            func.count(Comment.id).label("posts"),
        )
        .where(Comment.created_at >= since)
        .group_by(text("1"))
        .order_by(text("1"))
    )).all()

    prediction_trend = (await db.execute(
        select(
            func.date_trunc("day", Prediction.submitted_at).label("day"),
            func.count(Prediction.id).label("predictions"),
        )
        .where(Prediction.submitted_at >= since)
        .group_by(text("1"))
        .order_by(text("1"))
    )).all()

    # ── Top engaged users ──
    top_posters = (await db.execute(
        select(UserProfile.display_name, func.count(Comment.id).label("posts"))
        .join(Comment, Comment.user_id == UserProfile.user_id)
        .where(Comment.created_at >= since)
        .group_by(UserProfile.display_name)
        .order_by(text("2 DESC"))
        .limit(10)
    )).all()

    top_predictors = (await db.execute(
        select(UserProfile.display_name, func.count(Prediction.id).label("predictions"))
        .join(Prediction, Prediction.user_id == UserProfile.user_id)
        .where(Prediction.submitted_at >= since)
        .group_by(UserProfile.display_name)
        .order_by(text("2 DESC"))
        .limit(10)
    )).all()

    return {
        "period_days": days,
        "generated_at": now.isoformat(),
        "users": {
            "total": total_users,
            "active": active_users,
            "new_in_period": new_registrations,
            "registration_trend": [
                {"date": r.day.strftime("%Y-%m-%d"), "count": r.count} for r in reg_trend
            ],
        },
        "predictions": {
            "total": total_predictions,
            "in_period": recent_predictions,
            "unique_users_all_time": users_with_predictions,
            "trend": [
                {"date": r.day.strftime("%Y-%m-%d"), "count": r.predictions} for r in prediction_trend
            ],
        },
        "social": {
            "total_posts": total_posts,
            "posts_in_period": recent_posts,
            "unique_posters_in_period": unique_posters,
            "total_reactions": total_reactions,
            "reactions_in_period": recent_reactions,
            "total_follows": total_follows,
            "follows_in_period": recent_follows,
            "post_trend": [
                {"date": r.day.strftime("%Y-%m-%d"), "count": r.posts} for r in activity_trend
            ],
        },
        "challenges": {
            "total_challenges": total_challenges,
            "total_answers": total_challenge_answers,
            "answers_in_period": recent_challenge_answers,
        },
        "duels": {
            "total": total_duels,
            "in_period": recent_duels,
            "by_status": duel_status_breakdown,
        },
        "matches": {
            "total": total_matches,
            "finished_or_confirmed": confirmed_matches,
        },
        "notifications": {
            "in_app_total": total_notifications,
            "in_app_read": read_notifications,
            "read_rate": round(read_notifications / total_notifications * 100, 1) if total_notifications > 0 else 0,
            "emails_sent": emails_sent,
        },
        "top_engaged": {
            "posters": [{"name": r.display_name, "posts": r.posts} for r in top_posters],
            "predictors": [{"name": r.display_name, "predictions": r.predictions} for r in top_predictors],
        },
    }


# ── Community Odds Readiness ─────────────────────────────────────────────────

MIN_PREDICTIONS_THRESHOLD = 5

@router.get("/community-odds")
async def community_odds_report(
    db: Annotated[AsyncSession, Depends(get_db)],
    admin: Annotated[User, Depends(require_admin)],
    days: int = Query(30, ge=1, le=365, description="Lookback window in days"),
):
    """Community odds readiness report — prediction volume per match, threshold checks."""
    now = datetime.now(timezone.utc)
    since = now - timedelta(days=days)

    # Feature toggle
    toggle_row = (await db.execute(
        select(AppSetting.value).where(AppSetting.key == "community_odds_enabled")
    )).scalar_one_or_none()
    odds_enabled = toggle_row == "true" if toggle_row else False

    # Global stats
    total_users = (await db.execute(select(func.count(User.id)))).scalar()
    active_users = (await db.execute(
        select(func.count(User.id)).where(User.is_active == True)
    )).scalar()
    total_predictions = (await db.execute(select(func.count(Prediction.id)))).scalar()
    predictions_in_period = (await db.execute(
        select(func.count(Prediction.id)).where(Prediction.submitted_at >= since)
    )).scalar()

    # Upcoming matches (scheduled, not finished/cancelled)
    upcoming = (await db.execute(
        select(Match.id, Match.kickoff_utc)
        .where(Match.status.in_(["scheduled", "live"]))
        .where(Match.kickoff_utc >= now)
    )).all()
    upcoming_ids = [m.id for m in upcoming]

    # Prediction count per upcoming match
    if upcoming_ids:
        match_pred_counts = dict((await db.execute(
            select(Prediction.match_id, func.count(Prediction.id))
            .where(Prediction.match_id.in_(upcoming_ids))
            .group_by(Prediction.match_id)
        )).all())
    else:
        match_pred_counts = {}

    total_upcoming = len(upcoming_ids)
    matches_at_5 = sum(1 for c in match_pred_counts.values() if c >= 5)
    matches_at_10 = sum(1 for c in match_pred_counts.values() if c >= 10)
    matches_at_threshold = sum(1 for c in match_pred_counts.values() if c >= MIN_PREDICTIONS_THRESHOLD)
    matches_below = total_upcoming - matches_at_threshold

    # Average predictions per match (all matches that have at least 1 prediction)
    sub = (
        select(func.count(Prediction.id).label("cnt"))
        .group_by(Prediction.match_id)
        .subquery()
    )
    avg_per_match = (await db.execute(
        select(func.avg(sub.c.cnt))
    )).scalar()
    avg_per_match = round(float(avg_per_match), 1) if avg_per_match else 0

    # Distribution buckets for upcoming matches
    buckets = {"0": 0, "1-4": 0, "5-9": 0, "10-19": 0, "20+": 0}
    for mid in upcoming_ids:
        c = match_pred_counts.get(mid, 0)
        if c == 0:
            buckets["0"] += 1
        elif c < 5:
            buckets["1-4"] += 1
        elif c < 10:
            buckets["5-9"] += 1
        elif c < 20:
            buckets["10-19"] += 1
        else:
            buckets["20+"] += 1

    # Predictions in period by unique users
    unique_predictors_period = (await db.execute(
        select(func.count(func.distinct(Prediction.user_id)))
        .where(Prediction.submitted_at >= since)
    )).scalar()

    # Readiness score: % of upcoming matches meeting threshold
    readiness_pct = round(matches_at_threshold / total_upcoming * 100, 1) if total_upcoming > 0 else 0

    return {
        "period_days": days,
        "generated_at": now.isoformat(),
        "toggle": {
            "community_odds_enabled": odds_enabled,
        },
        "threshold": MIN_PREDICTIONS_THRESHOLD,
        "users": {
            "total": total_users,
            "active": active_users,
        },
        "predictions": {
            "total": total_predictions,
            "in_period": predictions_in_period,
            "unique_predictors_period": unique_predictors_period,
            "avg_per_match": avg_per_match,
        },
        "upcoming_matches": {
            "total": total_upcoming,
            "at_threshold": matches_at_threshold,
            "below_threshold": matches_below,
            "at_5_plus": matches_at_5,
            "at_10_plus": matches_at_10,
            "readiness_pct": readiness_pct,
        },
        "distribution": buckets,
    }


@router.put("/community-odds/toggle")
async def toggle_community_odds(
    db: Annotated[AsyncSession, Depends(get_db)],
    admin: Annotated[User, Depends(require_admin)],
):
    """Toggle community odds feature on/off."""
    row = (await db.execute(
        select(AppSetting).where(AppSetting.key == "community_odds_enabled")
    )).scalar_one_or_none()

    if row is None:
        row = AppSetting(key="community_odds_enabled", value="true")
        db.add(row)
        new_value = True
    else:
        new_value = row.value != "true"
        row.value = "true" if new_value else "false"

    return {"community_odds_enabled": new_value}
