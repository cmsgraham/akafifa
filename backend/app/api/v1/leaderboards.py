from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select, case, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import (
    Match,
    Prediction,
    Stage,
    Tournament,
    User,
    UserProfile,
)
from app.db.session import get_db

router = APIRouter(prefix="/api/leaderboards", tags=["leaderboards"])


def _build_leaderboard(profiles: list) -> list[dict]:
    """Build ranked leaderboard from UserProfile rows. challenge + duel are on the profile."""
    entries = []
    for p in profiles:
        challenge_bal = getattr(p, "challenge_points_balance", 0) or 0
        duel_bal = getattr(p, "duel_points_balance", 0) or 0
        entries.append({
            "user_id": str(p.user_id),
            "display_name": p.display_name,
            "avatar_url": p.avatar_path if p.avatar_path else None,
            "country": p.country,
            "points": p.total_points + challenge_bal + duel_bal,
            "prediction_points": p.total_points,
            "challenge_points": challenge_bal,
            "duel_points_balance": duel_bal,
            "exact_count": p.exact_hits,
            "outcome_count": p.outcome_hits,
            "duel_wins": p.duel_wins,
            "duel_losses": p.duel_losses,
            "duel_draws": p.duel_draws,
        })

    # Sort by tiebreaker order per design doc Section 5.5
    entries.sort(
        key=lambda e: (-e["points"], -e["exact_count"], -e["outcome_count"], e["display_name"].lower())
    )

    # Assign sequential rank (1, 2, 3, …) — like a real league table
    for i, entry in enumerate(entries):
        entry["rank"] = i + 1

    return entries


@router.get("/global")
async def global_leaderboard(
    db: Annotated[AsyncSession, Depends(get_db)],
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    country: str | None = Query(None),
):
    """Global leaderboard — all users ranked by total points (predictions + challenges + duels).

    Optional `country` filter restricts to users whose profile country matches.
    """
    stmt = (
        select(UserProfile)
        .join(User, User.id == UserProfile.user_id)
        .where(User.is_active == True)
        .order_by(
            UserProfile.total_points.desc(),
            UserProfile.exact_hits.desc(),
            UserProfile.outcome_hits.desc(),
        )
    )
    if country:
        stmt = stmt.where(UserProfile.country == country)
    result = await db.execute(stmt)
    profiles = list(result.scalars().all())

    entries = _build_leaderboard(profiles)
    page = entries[offset : offset + limit]

    return {
        "data": page,
        "total": len(entries),
        "pagination": {
            "offset": offset,
            "limit": limit,
            "has_more": offset + limit < len(entries),
        },
    }


@router.get("/tournament/{tournament_id}")
async def tournament_leaderboard(
    tournament_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
):
    """Tournament leaderboard — points only from matches in this tournament."""
    t = await db.get(Tournament, tournament_id)
    if not t:
        raise HTTPException(status_code=404, detail="Tournament not found")

    # Aggregate prediction points per user for this tournament's matches
    stmt = (
        select(
            Prediction.user_id,
            func.coalesce(func.sum(Prediction.points), 0).label("total_points"),
            func.sum(case((Prediction.result_type == "exact", 1), else_=0)).label("exact_hits"),
            func.sum(case((Prediction.result_type == "outcome", 1), else_=0)).label("outcome_hits"),
        )
        .join(Match, Prediction.match_id == Match.id)
        .where(
            Match.tournament_id == tournament_id,
            Prediction.points.isnot(None),
        )
        .group_by(Prediction.user_id)
    )
    rows = (await db.execute(stmt)).all()

    if not rows:
        return {"data": [], "total": 0, "tournament": {"id": str(t.id), "name": t.name}, "pagination": {"offset": offset, "limit": limit, "has_more": False}}

    # Fetch only active users
    active_user_ids_result = await db.execute(
        select(User.id).where(User.is_active == True, User.id.in_([r.user_id for r in rows]))
    )
    active_user_ids = set(active_user_ids_result.scalars().all())

    user_ids = [r.user_id for r in rows if r.user_id in active_user_ids]
    profiles_result = await db.execute(
        select(UserProfile).where(UserProfile.user_id.in_(user_ids))
    )
    profile_map = {p.user_id: p for p in profiles_result.scalars().all()}

    entries = []
    for r in rows:
        if r.user_id not in active_user_ids:
            continue
        p = profile_map.get(r.user_id)
        if not p:
            continue
        challenge_bal = getattr(p, "challenge_points_balance", 0) or 0
        duel_bal = getattr(p, "duel_points_balance", 0) or 0
        entries.append({
            "user_id": str(r.user_id),
            "display_name": p.display_name,
            "avatar_url": p.avatar_path if p.avatar_path else None,
            "points": r.total_points + challenge_bal + duel_bal,
            "prediction_points": r.total_points,
            "challenge_points": challenge_bal,
            "duel_points_balance": duel_bal,
            "exact_count": r.exact_hits,
            "outcome_count": r.outcome_hits,
            "duel_wins": p.duel_wins,
            "duel_losses": p.duel_losses,
            "duel_draws": p.duel_draws,
        })

    entries.sort(key=lambda e: (-e["points"], -e["exact_count"], -e["outcome_count"], e["display_name"].lower()))
    for i, entry in enumerate(entries):
        entry["rank"] = i + 1

    page = entries[offset : offset + limit]
    return {
        "data": page,
        "total": len(entries),
        "tournament": {"id": str(t.id), "name": t.name},
        "pagination": {"offset": offset, "limit": limit, "has_more": offset + limit < len(entries)},
    }


@router.get("/stage/{stage_id}")
async def stage_leaderboard(
    stage_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
):
    """Stage leaderboard — points from matches in a specific stage."""
    s = await db.get(Stage, stage_id)
    if not s:
        raise HTTPException(status_code=404, detail="Stage not found")

    # Aggregate prediction points per user for this stage's matches
    stmt = (
        select(
            Prediction.user_id,
            func.coalesce(func.sum(Prediction.points), 0).label("total_points"),
            func.sum(case((Prediction.result_type == "exact", 1), else_=0)).label("exact_hits"),
            func.sum(case((Prediction.result_type == "outcome", 1), else_=0)).label("outcome_hits"),
        )
        .join(Match, Prediction.match_id == Match.id)
        .where(
            Match.stage_id == stage_id,
            Prediction.points.isnot(None),
        )
        .group_by(Prediction.user_id)
    )
    rows = (await db.execute(stmt)).all()

    if not rows:
        return {"data": [], "total": 0, "stage": {"id": str(s.id), "name": s.name, "is_frozen": s.is_frozen}, "pagination": {"offset": offset, "limit": limit, "has_more": False}}

    # Fetch only active users
    active_user_ids_result = await db.execute(
        select(User.id).where(User.is_active == True, User.id.in_([r.user_id for r in rows]))
    )
    active_user_ids = set(active_user_ids_result.scalars().all())

    user_ids = [r.user_id for r in rows if r.user_id in active_user_ids]
    profiles_result = await db.execute(
        select(UserProfile).where(UserProfile.user_id.in_(user_ids))
    )
    profile_map = {p.user_id: p for p in profiles_result.scalars().all()}

    entries = []
    for r in rows:
        if r.user_id not in active_user_ids:
            continue
        p = profile_map.get(r.user_id)
        if not p:
            continue
        entries.append({
            "user_id": str(r.user_id),
            "display_name": p.display_name,
            "avatar_url": p.avatar_path if p.avatar_path else None,
            "points": r.total_points,
            "exact_count": r.exact_hits,
            "outcome_count": r.outcome_hits,
        })

    entries.sort(key=lambda e: (-e["points"], -e["exact_count"], -e["outcome_count"], e["display_name"].lower()))
    for i, entry in enumerate(entries):
        entry["rank"] = i + 1

    page = entries[offset : offset + limit]
    return {
        "data": page,
        "total": len(entries),
        "stage": {"id": str(s.id), "name": s.name, "is_frozen": s.is_frozen},
        "pagination": {"offset": offset, "limit": limit, "has_more": offset + limit < len(entries)},
    }
