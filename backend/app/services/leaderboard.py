"""Leaderboard calculation and caching service."""

from typing import Any

from sqlalchemy import select, func, case
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import Prediction, UserProfile, User


async def compute_leaderboard(
    db: AsyncSession,
    tournament_id: str | None = None,
    stage_id: str | None = None,
) -> list[dict[str, Any]]:
    """Compute leaderboard with full tie-breaker chain.

    Tie-breaker order:
    1. Highest total points
    2. Highest exact-score hit count
    3. Highest correct-outcome hit count
    4. Earliest average prediction submission time before lock-out
    5. Username alphabetical (stable final tie-breaker)
    """
    from app.db.models import Match

    query = (
        select(
            UserProfile.user_id,
            UserProfile.display_name,
            UserProfile.avatar_path,
            func.coalesce(func.sum(Prediction.points), 0).label("total_points"),
            func.count(
                case((Prediction.result_type == "exact", 1))
            ).label("exact_hits"),
            func.count(
                case((Prediction.result_type == "outcome", 1))
            ).label("outcome_hits"),
            func.avg(Prediction.submitted_at).label("avg_submitted"),
            User.email,
        )
        .join(User, User.id == UserProfile.user_id)
        .outerjoin(Prediction, Prediction.user_id == UserProfile.user_id)
    )

    if tournament_id:
        query = query.outerjoin(Match, Match.id == Prediction.match_id).where(
            Match.tournament_id == tournament_id
        )

    if stage_id:
        query = query.outerjoin(Match, Match.id == Prediction.match_id).where(
            Match.stage_id == stage_id
        )

    query = query.group_by(
        UserProfile.user_id,
        UserProfile.display_name,
        UserProfile.avatar_path,
        User.email,
    ).order_by(
        func.coalesce(func.sum(Prediction.points), 0).desc(),
        func.count(case((Prediction.result_type == "exact", 1))).desc(),
        func.count(case((Prediction.result_type == "outcome", 1))).desc(),
        func.avg(Prediction.submitted_at).asc(),
        User.email.asc(),
    )

    result = await db.execute(query)
    rows = result.all()

    return [
        {
            "rank": idx + 1,
            "user_id": str(row.user_id),
            "display_name": row.display_name,
            "avatar_path": row.avatar_path,
            "total_points": int(row.total_points),
            "exact_hits": int(row.exact_hits),
            "outcome_hits": int(row.outcome_hits),
        }
        for idx, row in enumerate(rows)
    ]
