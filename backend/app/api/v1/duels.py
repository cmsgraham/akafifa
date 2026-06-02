"""Duel endpoints — create, accept, decline, cancel, list duels with point staking."""

from datetime import datetime, timedelta, timezone
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import and_, or_, select, func, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import aliased

from app.core.config import settings
from app.core.dependencies import get_current_user
from app.db.models import (
    AuditLog,
    DuelChallenge,
    Match,
    Team,
    User,
    UserProfile,
)
from app.db.session import get_db
from app.services.notifications import notify, NotifType
from app.services.activity import create_activity

router = APIRouter(prefix="/api", tags=["duels"])

MIN_STAKE = 1
MAX_STAKE = 50


class CreateDuelBody(BaseModel):
    opponent_id: UUID
    stake_points: int = Field(..., ge=MIN_STAKE, le=MAX_STAKE)
    message: str | None = Field(None, max_length=200)


def _available_points(profile: UserProfile) -> int:
    """Compute points available for wagering."""
    return profile.total_points + profile.duel_points_balance + profile.challenge_points_balance


# ── Create duel ──────────────────────────────────────────────────────────────

@router.post("/matches/{match_id}/duels", status_code=201)
async def create_duel(
    match_id: UUID,
    body: CreateDuelBody,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    """Challenge another user to a prediction duel on a specific match."""
    if body.opponent_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot challenge yourself")

    match = (await db.execute(select(Match).where(Match.id == match_id))).scalar_one_or_none()
    if not match:
        raise HTTPException(status_code=404, detail="Match not found")
    if match.status in ("confirmed", "cancelled"):
        raise HTTPException(status_code=400, detail="Cannot create duel for a finished or cancelled match")

    opponent = (await db.execute(select(User).where(User.id == body.opponent_id))).scalar_one_or_none()
    if not opponent or not opponent.is_active:
        raise HTTPException(status_code=404, detail="Opponent not found")

    # Validate challenger has enough points
    challenger_profile = (await db.execute(
        select(UserProfile).where(UserProfile.user_id == current_user.id)
    )).scalar_one_or_none()
    if not challenger_profile or _available_points(challenger_profile) < body.stake_points:
        raise HTTPException(status_code=400, detail="Insufficient points to stake")

    # One active duel per challenger/opponent/match
    existing = (await db.execute(
        select(DuelChallenge).where(
            DuelChallenge.match_id == match_id,
            DuelChallenge.status.in_(["pending", "active"]),
            or_(
                and_(DuelChallenge.challenger_id == current_user.id, DuelChallenge.opponent_id == body.opponent_id),
                and_(DuelChallenge.challenger_id == body.opponent_id, DuelChallenge.opponent_id == current_user.id),
            ),
        )
    )).scalar_one_or_none()
    if existing:
        raise HTTPException(status_code=409, detail="An active duel already exists for this match")

    expires_at = datetime.now(timezone.utc) + timedelta(hours=settings.DUEL_INVITE_EXPIRY_HOURS)

    duel = DuelChallenge(
        match_id=match_id,
        challenger_id=current_user.id,
        opponent_id=body.opponent_id,
        stake_points=body.stake_points,
        message=body.message.strip() if body.message else None,
        status="pending",
        expires_at=expires_at,
    )
    db.add(duel)

    db.add(AuditLog(
        actor_id=current_user.id,
        action="duel_created",
        resource_type="duel",
        after_state={"match_id": str(match_id), "opponent_id": str(body.opponent_id), "stake": body.stake_points},
    ))

    # Reuse challenger_profile already loaded above for points check
    challenger_name = challenger_profile.display_name if challenger_profile else "Someone"

    # Load opponent name and match teams for activity
    opponent_profile = (await db.execute(
        select(UserProfile).where(UserProfile.user_id == body.opponent_id)
    )).scalar_one_or_none()
    opponent_name = opponent_profile.display_name if opponent_profile else "Someone"

    _HT = aliased(Team)
    _AT = aliased(Team)
    team_row = (await db.execute(
        select(_HT.name, _AT.name)
        .select_from(Match)
        .join(_HT, _HT.id == Match.home_team_id)
        .join(_AT, _AT.id == Match.away_team_id)
        .where(Match.id == match_id)
    )).one_or_none()
    home_team = team_row[0] if team_row else "?"
    away_team = team_row[1] if team_row else "?"

    await create_activity(
        db,
        activity_type="duel_created",
        title=f"{challenger_name} challenged {opponent_name}",
        body=f"{body.stake_points}-point stake · {home_team} vs {away_team}",
        actor_user_id=current_user.id,
        related_entity_type="duel",
        related_entity_id=duel.id,
        visibility="participants_and_friends",
        participant1_id=current_user.id,
        participant2_id=body.opponent_id,
        metadata={
            "duel_id": str(duel.id),
            "challenger_id": str(current_user.id),
            "challenger_name": challenger_name,
            "opponent_id": str(body.opponent_id),
            "opponent_name": opponent_name,
            "stake_points": body.stake_points,
            "match_id": str(match_id),
            "match_home_team": home_team,
            "match_away_team": away_team,
        },
    )

    await notify(
        db,
        user_id=body.opponent_id,
        type=NotifType.DUEL_INVITATION,
        title="New Duel Challenge!",
        message=f"{challenger_name} challenged you to a {body.stake_points}-point duel.",
        actor_user_id=current_user.id,
        related_entity_type="duel",
        related_entity_id=duel.id,
        action_url="/duels",
        dedup_key=f"duel_invite:{duel.id}",
    )

    await db.commit()
    await db.refresh(duel)

    return {
        "data": {
            "id": str(duel.id),
            "status": duel.status,
            "stake_points": duel.stake_points,
            "expires_at": duel.expires_at.isoformat(),
        }
    }


# ── Accept duel (escrow both stakes) ────────────────────────────────────────

@router.post("/duels/{duel_id}/accept")
async def accept_duel(
    duel_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    """Accept a duel invitation — escrow stake from both users."""
    duel = (await db.execute(
        select(DuelChallenge).where(DuelChallenge.id == duel_id).with_for_update()
    )).scalar_one_or_none()
    if not duel:
        raise HTTPException(status_code=404, detail="Duel not found")
    if duel.opponent_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only the challenged user can accept")
    if duel.status != "pending":
        raise HTTPException(status_code=400, detail=f"Duel is {duel.status}, cannot accept")
    if datetime.now(timezone.utc) > duel.expires_at:
        duel.status = "expired"
        await db.commit()
        raise HTTPException(status_code=400, detail="Duel invitation has expired")

    stake = duel.stake_points

    # Load both profiles with row-level lock to prevent double-spending
    challenger_profile = (await db.execute(
        select(UserProfile).where(UserProfile.user_id == duel.challenger_id).with_for_update()
    )).scalar_one_or_none()
    opponent_profile = (await db.execute(
        select(UserProfile).where(UserProfile.user_id == duel.opponent_id).with_for_update()
    )).scalar_one_or_none()

    if not challenger_profile or _available_points(challenger_profile) < stake:
        raise HTTPException(status_code=400, detail="Challenger no longer has enough points")
    if not opponent_profile or _available_points(opponent_profile) < stake:
        raise HTTPException(status_code=400, detail="You do not have enough points to accept")

    # Escrow: deduct from both
    challenger_profile.duel_points_balance -= stake
    opponent_profile.duel_points_balance -= stake

    duel.status = "active"

    db.add(AuditLog(
        actor_id=current_user.id,
        action="duel_accepted",
        resource_type="duel",
        resource_id=duel.id,
        after_state={"stake": stake, "challenger_balance": challenger_profile.duel_points_balance,
                     "opponent_balance": opponent_profile.duel_points_balance},
    ))

    await notify(
        db,
        user_id=duel.challenger_id,
        type=NotifType.DUEL_ACCEPTED,
        title="Duel Accepted!",
        message=f"{opponent_profile.display_name} accepted your {stake}-point duel.",
        actor_user_id=current_user.id,
        related_entity_type="duel",
        related_entity_id=duel.id,
        action_url="/duels",
        dedup_key=f"duel_accept:{duel.id}",
    )

    await db.commit()
    return {"data": {"id": str(duel.id), "status": "active", "stake_points": stake}}


# ── Decline duel ─────────────────────────────────────────────────────────────

@router.post("/duels/{duel_id}/decline")
async def decline_duel(
    duel_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    """Decline a duel invitation."""
    duel = (await db.execute(select(DuelChallenge).where(DuelChallenge.id == duel_id))).scalar_one_or_none()
    if not duel:
        raise HTTPException(status_code=404, detail="Duel not found")
    if duel.opponent_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only the challenged user can decline")
    if duel.status != "pending":
        raise HTTPException(status_code=400, detail=f"Duel is {duel.status}, cannot decline")

    duel.status = "declined"

    db.add(AuditLog(
        actor_id=current_user.id,
        action="duel_declined",
        resource_type="duel",
        resource_id=duel.id,
    ))

    # Fetch opponent display name for notification
    opp_profile = (await db.execute(
        select(UserProfile).where(UserProfile.user_id == current_user.id)
    )).scalar_one_or_none()
    opp_name = opp_profile.display_name if opp_profile else "Your opponent"

    await notify(
        db,
        user_id=duel.challenger_id,
        type=NotifType.DUEL_DECLINED,
        title="Duel Declined",
        message=f"{opp_name} declined your duel challenge.",
        actor_user_id=current_user.id,
        related_entity_type="duel",
        related_entity_id=duel.id,
        action_url="/duels",
        dedup_key=f"duel_decline:{duel.id}",
    )

    await db.commit()
    return {"data": {"id": str(duel.id), "status": "declined"}}


# ── Cancel duel (challenger only, while pending) ─────────────────────────────

@router.post("/duels/{duel_id}/cancel")
async def cancel_duel(
    duel_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    """Cancel a pending duel (challenger only)."""
    duel = (await db.execute(select(DuelChallenge).where(DuelChallenge.id == duel_id))).scalar_one_or_none()
    if not duel:
        raise HTTPException(status_code=404, detail="Duel not found")
    if duel.challenger_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only the challenger can cancel")
    if duel.status != "pending":
        raise HTTPException(status_code=400, detail=f"Duel is {duel.status}, cannot cancel")

    duel.status = "declined"

    db.add(AuditLog(
        actor_id=current_user.id,
        action="duel_cancelled",
        resource_type="duel",
        resource_id=duel.id,
    ))

    await db.commit()
    return {"data": {"id": str(duel.id), "status": "declined"}}


# ── List my duels ────────────────────────────────────────────────────────────

@router.get("/me/duels")
async def my_duels(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    status_filter: str | None = Query(None, alias="status"),
    limit: int = Query(30, ge=1, le=100),
    offset: int = Query(0, ge=0),
):
    """List duels involving the current user."""
    HomeTeam = aliased(Team)
    AwayTeam = aliased(Team)
    ChallengerProfile = aliased(UserProfile)
    OpponentProfile = aliased(UserProfile)

    query = (
        select(
            DuelChallenge,
            HomeTeam.name,
            AwayTeam.name,
            ChallengerProfile.display_name,
            ChallengerProfile.avatar_path,
            OpponentProfile.display_name,
            OpponentProfile.avatar_path,
            Match.kickoff_utc,
            Match.status,
        )
        .join(Match, Match.id == DuelChallenge.match_id)
        .join(HomeTeam, HomeTeam.id == Match.home_team_id)
        .join(AwayTeam, AwayTeam.id == Match.away_team_id)
        .join(ChallengerProfile, ChallengerProfile.user_id == DuelChallenge.challenger_id)
        .join(OpponentProfile, OpponentProfile.user_id == DuelChallenge.opponent_id)
        .where(
            or_(
                DuelChallenge.challenger_id == current_user.id,
                DuelChallenge.opponent_id == current_user.id,
            )
        )
        .order_by(DuelChallenge.created_at.desc())
    )

    if status_filter:
        query = query.where(DuelChallenge.status == status_filter)

    query = query.offset(offset).limit(limit)
    rows = (await db.execute(query)).all()

    data = []
    for (
        duel, home_team, away_team, challenger_name, challenger_avatar,
        opponent_name, opponent_avatar, kickoff, match_status
    ) in rows:
        is_challenger = duel.challenger_id == current_user.id
        other_name = opponent_name if is_challenger else challenger_name
        other_avatar = opponent_avatar if is_challenger else challenger_avatar

        result_text = None
        points_delta = None
        if duel.status == "completed":
            if duel.winner_id == current_user.id:
                result_text = "won"
                points_delta = duel.stake_points  # net gain
            elif duel.winner_id is not None:
                result_text = "lost"
                points_delta = -duel.stake_points  # net loss
            else:
                result_text = "draw"
                points_delta = 0

        my_score = None
        their_score = None
        if duel.challenger_score is not None:
            my_score = duel.challenger_score if is_challenger else duel.opponent_score
            their_score = duel.opponent_score if is_challenger else duel.challenger_score

        data.append({
            "id": str(duel.id),
            "match_id": str(duel.match_id),
            "match_summary": f"{home_team} vs {away_team}",
            "match_kickoff": kickoff.isoformat() if kickoff else None,
            "match_status": match_status,
            "challenger_id": str(duel.challenger_id),
            "opponent_id": str(duel.opponent_id),
            "challenger_name": challenger_name,
            "opponent_name": opponent_name,
            "other_name": other_name,
            "other_avatar": other_avatar,
            "is_challenger": is_challenger,
            "status": duel.status,
            "stake_points": duel.stake_points,
            "pot": duel.stake_points * 2,
            "result": result_text,
            "points_delta": points_delta,
            "my_score": my_score,
            "their_score": their_score,
            "winner_id": str(duel.winner_id) if duel.winner_id else None,
            "resolved_at": duel.resolved_at.isoformat() if duel.resolved_at else None,
            "message": duel.message,
            "expires_at": duel.expires_at.isoformat(),
            "created_at": duel.created_at.isoformat(),
        })

    return {"data": data}


# ── My available points ──────────────────────────────────────────────────────

@router.get("/me/duel-balance")
async def my_duel_balance(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    """Return the current user's available points for wagering."""
    profile = (await db.execute(
        select(UserProfile).where(UserProfile.user_id == current_user.id)
    )).scalar_one_or_none()
    if not profile:
        return {"available_points": 0, "total_points": 0, "duel_points_balance": 0, "challenge_points_balance": 0}
    return {
        "available_points": _available_points(profile),
        "total_points": profile.total_points,
        "duel_points_balance": profile.duel_points_balance,
        "challenge_points_balance": profile.challenge_points_balance,
    }


# ── Search users for duel opponent ───────────────────────────────────────────

@router.get("/duels/opponents")
async def search_opponents(
    q: str = Query(..., min_length=1, max_length=50),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    limit: int = Query(10, ge=1, le=20),
):
    """Search for users to challenge (excludes self)."""
    rows = (await db.execute(
        select(UserProfile.user_id, UserProfile.display_name, UserProfile.avatar_path)
        .where(
            func.lower(UserProfile.display_name).like(func.lower(q) + "%"),
            UserProfile.user_id != current_user.id,
        )
        .order_by(UserProfile.display_name)
        .limit(limit)
    )).all()

    return {
        "data": [
            {"id": str(uid), "display_name": dn, "avatar_url": avatar}
            for uid, dn, avatar in rows
        ]
    }
