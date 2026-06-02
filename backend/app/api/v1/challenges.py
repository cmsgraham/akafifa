from datetime import datetime, timezone
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user
from app.db.models import (
    FlashChallenge,
    FlashChallengeAnswer,
    FlashChallengeOption,
    Match,
    PointsLedger,
    Team,
    User,
    UserProfile,
)
from app.db.session import get_db

router = APIRouter(prefix="/api", tags=["challenges"])


# ── Schemas ──────────────────────────────────────────────────────────────────

class AnswerRequest(BaseModel):
    option_id: UUID


# ── Helpers ──────────────────────────────────────────────────────────────────

def _available_balance(profile: UserProfile) -> int:
    """Total spendable points = predictions + duel net + challenge net."""
    return (
        (profile.total_points or 0)
        + (profile.duel_points_balance or 0)
        + (profile.challenge_points_balance or 0)
    )


# ── Active Challenges ────────────────────────────────────────────────────────

@router.get("/challenges/active")
async def active_challenges(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    """Return challenges that are currently active (status=active, now between open_at and close_at)."""
    now = datetime.now(timezone.utc)

    result = await db.execute(
        select(FlashChallenge)
        .where(
            FlashChallenge.status == "active",
            FlashChallenge.open_at <= now,
            FlashChallenge.close_at > now,
        )
        .order_by(FlashChallenge.close_at.asc())
    )
    challenges = list(result.scalars().all())

    # Fetch user's existing answers in one query
    if challenges:
        challenge_ids = [c.id for c in challenges]
        ans_result = await db.execute(
            select(FlashChallengeAnswer).where(
                FlashChallengeAnswer.challenge_id.in_(challenge_ids),
                FlashChallengeAnswer.user_id == current_user.id,
            )
        )
        user_answers = {a.challenge_id: a for a in ans_result.scalars().all()}
    else:
        user_answers = {}

    # Fetch user profile for balance display
    profile = (await db.execute(
        select(UserProfile).where(UserProfile.user_id == current_user.id)
    )).scalar_one_or_none()
    balance = _available_balance(profile) if profile else 0

    data = []
    for c in challenges:
        opts_result = await db.execute(
            select(FlashChallengeOption)
            .where(FlashChallengeOption.challenge_id == c.id)
            .order_by(FlashChallengeOption.order_index)
        )
        opts = list(opts_result.scalars().all())

        user_answer = user_answers.get(c.id)

        match_info = None
        if c.match_id:
            home_result = await db.execute(
                select(Match, Team).outerjoin(Team, Team.id == Match.home_team_id).where(Match.id == c.match_id)
            )
            row = home_result.first()
            if row:
                match_obj = row[0]
                home_team = row[1]
                away_team = (await db.execute(select(Team).where(Team.id == match_obj.away_team_id))).scalar_one_or_none()
                match_info = {
                    "id": str(match_obj.id),
                    "home_team": home_team.name if home_team else "TBD",
                    "away_team": away_team.name if away_team else "TBD",
                }

        data.append({
            "id": str(c.id),
            "title": c.title,
            "description": c.description,
            "type": c.type,
            "scope": c.scope,
            "participation_cost": c.participation_cost,
            "reward_points": c.reward_points,
            "open_at": c.open_at.isoformat(),
            "close_at": c.close_at.isoformat(),
            "match": match_info,
            "options": [
                {"id": str(o.id), "label": o.label, "order_index": o.order_index}
                for o in opts
            ],
            "answered": user_answer is not None,
            "selected_option_id": str(user_answer.option_id) if user_answer else None,
        })

    return {"data": data, "available_balance": balance}


# ── Submit / Edit Answer ─────────────────────────────────────────────────────

@router.post("/challenges/{challenge_id}/answer", status_code=201)
async def answer_challenge(
    challenge_id: UUID,
    body: AnswerRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    """Submit or edit an answer to a flash challenge.
    First submission deducts participation_cost; edits are free (no re-charge).
    """
    now = datetime.now(timezone.utc)

    challenge = (await db.execute(
        select(FlashChallenge).where(FlashChallenge.id == challenge_id)
    )).scalar_one_or_none()
    if not challenge:
        raise HTTPException(status_code=404, detail="Challenge not found")

    if challenge.status != "active":
        raise HTTPException(status_code=400, detail="Challenge is not open for answers")
    if now < challenge.open_at:
        raise HTTPException(status_code=400, detail="Challenge has not opened yet")
    if now >= challenge.close_at:
        raise HTTPException(status_code=400, detail="Challenge has closed")

    # Verify option belongs to this challenge
    option = (await db.execute(
        select(FlashChallengeOption).where(
            FlashChallengeOption.id == body.option_id,
            FlashChallengeOption.challenge_id == challenge_id,
        )
    )).scalar_one_or_none()
    if not option:
        raise HTTPException(status_code=400, detail="Invalid option for this challenge")

    # Check for existing answer
    existing = (await db.execute(
        select(FlashChallengeAnswer).where(
            FlashChallengeAnswer.challenge_id == challenge_id,
            FlashChallengeAnswer.user_id == current_user.id,
        )
    )).scalar_one_or_none()

    if existing:
        # Edit: just update the option, no re-charge
        existing.option_id = body.option_id
        await db.commit()
        return {"message": "Answer updated (no additional cost)", "option_id": str(body.option_id), "is_edit": True}

    # First submission: deduct participation cost
    cost = challenge.participation_cost

    # Lock user profile row for atomic balance update
    profile = (await db.execute(
        select(UserProfile)
        .where(UserProfile.user_id == current_user.id)
        .with_for_update()
    )).scalar_one_or_none()
    if not profile:
        raise HTTPException(status_code=400, detail="User profile not found")

    available = _available_balance(profile)
    if available < cost:
        raise HTTPException(
            status_code=400,
            detail=f"Insufficient points. Need {cost}, have {available}."
        )

    # Deduct from challenge_points_balance
    profile.challenge_points_balance -= cost
    new_balance = _available_balance(profile)

    # Record in points ledger
    ledger = PointsLedger(
        user_id=current_user.id,
        transaction_type="challenge_entry",
        reference_type="flash_challenge",
        reference_id=challenge_id,
        points_delta=-cost,
        balance_after=new_balance,
        metadata_json={"challenge_title": challenge.title, "cost": cost},
    )
    db.add(ledger)

    answer = FlashChallengeAnswer(
        challenge_id=challenge_id,
        user_id=current_user.id,
        option_id=body.option_id,
        paid_points=cost,
        outcome_status="pending",
    )
    db.add(answer)
    await db.commit()

    return {
        "message": "Answer submitted",
        "option_id": str(body.option_id),
        "points_deducted": cost,
        "available_balance": new_balance,
        "is_edit": False,
    }


# ── My Challenges ────────────────────────────────────────────────────────────

@router.get("/me/challenges")
async def my_challenges(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
):
    """Return user's challenge answer history with results."""
    result = await db.execute(
        select(FlashChallengeAnswer, FlashChallenge)
        .join(FlashChallenge, FlashChallenge.id == FlashChallengeAnswer.challenge_id)
        .where(FlashChallengeAnswer.user_id == current_user.id)
        .order_by(FlashChallengeAnswer.submitted_at.desc())
        .offset(offset)
        .limit(limit)
    )
    rows = list(result.all())

    data = []
    for answer, challenge in rows:
        opts_result = await db.execute(
            select(FlashChallengeOption)
            .where(FlashChallengeOption.challenge_id == challenge.id)
            .order_by(FlashChallengeOption.order_index)
        )
        opts = list(opts_result.scalars().all())

        selected_label = next(
            (o.label for o in opts if o.id == answer.option_id), None
        )
        correct_label = next(
            (o.label for o in opts if o.id == challenge.correct_option_id), None
        ) if challenge.correct_option_id else None

        is_correct = (
            answer.option_id == challenge.correct_option_id
            if challenge.correct_option_id
            else None
        )

        # Net effect: reward_points_awarded - paid_points (negative = loss)
        net_points = None
        if answer.outcome_status == "won":
            net_points = (answer.reward_points_awarded or 0) - answer.paid_points
        elif answer.outcome_status == "lost":
            net_points = -answer.paid_points
        elif answer.outcome_status == "refunded":
            net_points = 0

        data.append({
            "id": str(answer.id),
            "challenge_id": str(challenge.id),
            "title": challenge.title,
            "description": challenge.description,
            "type": challenge.type,
            "scope": challenge.scope,
            "status": challenge.status,
            "participation_cost": challenge.participation_cost,
            "reward_points": challenge.reward_points,
            "selected_option_id": str(answer.option_id),
            "selected_label": selected_label,
            "correct_option_id": str(challenge.correct_option_id) if challenge.correct_option_id else None,
            "correct_label": correct_label,
            "is_correct": is_correct,
            "paid_points": answer.paid_points,
            "reward_points_awarded": answer.reward_points_awarded,
            "outcome_status": answer.outcome_status,
            "net_points": net_points,
            "submitted_at": answer.submitted_at.isoformat(),
            "resolved_at": challenge.resolved_at.isoformat() if challenge.resolved_at else None,
            "options": [
                {"id": str(o.id), "label": o.label}
                for o in opts
            ],
        })

    return {"data": data}
