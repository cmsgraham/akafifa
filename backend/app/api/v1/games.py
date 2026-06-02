from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import select, func, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user
from app.db.models import User, PenaltyRushScore, UserProfile
from app.db.session import get_db

router = APIRouter(prefix="/api", tags=["games"])


# ── Schemas ──────────────────────────────────────────────────────────────────


class ScoreSubmit(BaseModel):
    score: int = Field(..., ge=0, lt=100000)
    best_streak: int = Field(0, ge=0, le=1000)
    accuracy_pct: int = Field(0, ge=0, le=100)
    duration_secs: int = Field(..., ge=5, le=36000)
    level_reached: int = Field(1, ge=1, le=100)


class ScoreOut(BaseModel):
    score: int
    best_streak: int
    accuracy_pct: int
    duration_secs: int
    level_reached: int
    is_new_best: bool = False


class BestOut(BaseModel):
    best_score: int
    best_streak: int


class LeaderboardEntry(BaseModel):
    rank: int
    display_name: str
    avatar_url: str | None
    best_score: int
    best_streak: int
    user_id: str


class LeaderboardOut(BaseModel):
    entries: list[LeaderboardEntry]
    my_rank: int | None = None


# ── Endpoints ────────────────────────────────────────────────────────────────


@router.post("/me/penalty-rush/score", response_model=ScoreOut)
async def submit_score(
    payload: ScoreSubmit,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Get current best
    result = await db.execute(
        select(func.max(PenaltyRushScore.score)).where(
            PenaltyRushScore.user_id == current_user.id
        )
    )
    current_best = result.scalar() or 0
    is_new_best = payload.score > current_best

    entry = PenaltyRushScore(
        user_id=current_user.id,
        score=payload.score,
        best_streak=payload.best_streak,
        accuracy_pct=payload.accuracy_pct,
        duration_secs=payload.duration_secs,
        level_reached=payload.level_reached,
    )
    db.add(entry)
    await db.commit()

    return ScoreOut(
        score=payload.score,
        best_streak=payload.best_streak,
        accuracy_pct=payload.accuracy_pct,
        duration_secs=payload.duration_secs,
        level_reached=payload.level_reached,
        is_new_best=is_new_best,
    )


@router.get("/me/penalty-rush/best", response_model=BestOut)
async def get_best_score(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(
            func.coalesce(func.max(PenaltyRushScore.score), 0),
            func.coalesce(func.max(PenaltyRushScore.best_streak), 0),
        ).where(PenaltyRushScore.user_id == current_user.id)
    )
    row = result.one()
    return BestOut(best_score=row[0], best_streak=row[1])


@router.get("/penalty-rush/leaderboard", response_model=LeaderboardOut)
async def get_leaderboard(
    limit: int = Query(10, ge=1, le=50),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Top scores — one entry per user (their personal best)."""
    # Sub-query: each user's best score
    best_sub = (
        select(
            PenaltyRushScore.user_id,
            func.max(PenaltyRushScore.score).label("best_score"),
            func.max(PenaltyRushScore.best_streak).label("best_streak"),
        )
        .group_by(PenaltyRushScore.user_id)
        .subquery()
    )

    rows = (
        await db.execute(
            select(
                best_sub.c.user_id,
                best_sub.c.best_score,
                best_sub.c.best_streak,
                UserProfile.display_name,
                UserProfile.avatar_path,
            )
            .join(UserProfile, UserProfile.user_id == best_sub.c.user_id)
            .order_by(desc(best_sub.c.best_score))
            .limit(limit)
        )
    ).all()

    entries = [
        LeaderboardEntry(
            rank=idx + 1,
            display_name=r.display_name,
            avatar_url=r.avatar_path,
            best_score=r.best_score,
            best_streak=r.best_streak,
            user_id=str(r.user_id),
        )
        for idx, r in enumerate(rows)
    ]

    # Find current user's rank
    my_rank = None
    for e in entries:
        if e.user_id == str(current_user.id):
            my_rank = e.rank
            break

    if my_rank is None:
        # User not in top N — find their rank
        count_result = await db.execute(
            select(func.count()).select_from(best_sub).where(
                best_sub.c.best_score > (
                    select(func.coalesce(func.max(PenaltyRushScore.score), 0)).where(
                        PenaltyRushScore.user_id == current_user.id
                    )
                )
            )
        )
        above = count_result.scalar() or 0
        # Only set rank if user has played
        user_has_score = (
            await db.execute(
                select(func.count()).where(PenaltyRushScore.user_id == current_user.id)
            )
        ).scalar()
        if user_has_score:
            my_rank = above + 1

    return LeaderboardOut(entries=entries, my_rank=my_rank)
