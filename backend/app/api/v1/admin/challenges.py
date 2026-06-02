from datetime import datetime, timezone
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import delete as sql_delete, func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import require_admin
from app.db.models import (
    AuditLog,
    FlashChallenge,
    FlashChallengeAnswer,
    FlashChallengeOption,
    Match,
    PointsLedger,
    Stage,
    Tournament,
    User,
    UserProfile,
)
from app.db.session import get_db
from app.services.notifications import notify, notify_many, NotifType
from app.services.activity import create_activity

router = APIRouter(prefix="/api/admin/challenges", tags=["admin-challenges"])


# ── Schemas ──────────────────────────────────────────────────────────────────

class OptionIn(BaseModel):
    label: str = Field(..., min_length=1, max_length=200)


class CreateChallengeRequest(BaseModel):
    tournament_id: UUID
    match_id: UUID | None = None
    stage_id: UUID | None = None
    scope: str  # "match" or "stage"
    title: str = Field(..., min_length=1, max_length=200)
    description: str | None = None
    type: str  # "yes_no" or "multiple_choice"
    participation_cost: int = Field(1, ge=0, le=50)
    reward_points: int = Field(3, ge=0, le=100)
    open_at: str  # ISO 8601
    close_at: str  # ISO 8601
    options: list[OptionIn] = Field(default_factory=list)


class UpdateChallengeRequest(BaseModel):
    title: str | None = None
    description: str | None = None
    participation_cost: int | None = Field(None, ge=0, le=50)
    reward_points: int | None = Field(None, ge=0, le=100)
    open_at: str | None = None
    close_at: str | None = None
    status: str | None = None  # draft, active, locked, cancelled


class ResolveChallengeRequest(BaseModel):
    correct_option_id: UUID


# ── Helpers ──────────────────────────────────────────────────────────────────

def _available_balance(profile: UserProfile) -> int:
    return (
        (profile.total_points or 0)
        + (profile.duel_points_balance or 0)
        + (profile.challenge_points_balance or 0)
    )


# ── List ─────────────────────────────────────────────────────────────────────

@router.get("")
async def list_challenges(
    db: Annotated[AsyncSession, Depends(get_db)],
    admin: Annotated[User, Depends(require_admin)],
    tournament_id: UUID | None = Query(None),
    challenge_status: str | None = Query(None, alias="status"),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
):
    query = select(FlashChallenge).order_by(FlashChallenge.created_at.desc())
    if tournament_id:
        query = query.where(FlashChallenge.tournament_id == tournament_id)
    if challenge_status:
        query = query.where(FlashChallenge.status == challenge_status)
    query = query.offset(offset).limit(limit)

    result = await db.execute(query)
    challenges = list(result.scalars().all())

    data = []
    for c in challenges:
        opts_result = await db.execute(
            select(FlashChallengeOption)
            .where(FlashChallengeOption.challenge_id == c.id)
            .order_by(FlashChallengeOption.order_index)
        )
        opts = list(opts_result.scalars().all())

        ans_count = (await db.execute(
            select(func.count()).select_from(FlashChallengeAnswer)
            .where(FlashChallengeAnswer.challenge_id == c.id)
        )).scalar() or 0

        data.append({
            "id": str(c.id),
            "tournament_id": str(c.tournament_id),
            "stage_id": str(c.stage_id) if c.stage_id else None,
            "match_id": str(c.match_id) if c.match_id else None,
            "title": c.title,
            "description": c.description,
            "scope": c.scope,
            "type": c.type,
            "participation_cost": c.participation_cost,
            "reward_points": c.reward_points,
            "status": c.status,
            "open_at": c.open_at.isoformat(),
            "close_at": c.close_at.isoformat(),
            "correct_option_id": str(c.correct_option_id) if c.correct_option_id else None,
            "resolved_at": c.resolved_at.isoformat() if c.resolved_at else None,
            "answer_count": ans_count,
            "options": [
                {"id": str(o.id), "label": o.label, "order_index": o.order_index}
                for o in opts
            ],
            "created_at": c.created_at.isoformat(),
        })
    return {"data": data}


# ── Create ───────────────────────────────────────────────────────────────────

@router.post("", status_code=201)
async def create_challenge(
    body: CreateChallengeRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    admin: Annotated[User, Depends(require_admin)],
):
    if body.scope not in ("match", "stage", "open"):
        raise HTTPException(status_code=400, detail="Scope must be 'match', 'stage', or 'open'")
    if body.type not in ("yes_no", "multiple_choice"):
        raise HTTPException(status_code=400, detail="Type must be 'yes_no' or 'multiple_choice'")

    if body.type == "yes_no":
        body.options = [OptionIn(label="Yes"), OptionIn(label="No")]
    elif len(body.options) < 2:
        raise HTTPException(status_code=400, detail="Multiple choice needs at least 2 options")

    open_at = datetime.fromisoformat(body.open_at)
    close_at = datetime.fromisoformat(body.close_at)
    if close_at <= open_at:
        raise HTTPException(status_code=400, detail="close_at must be after open_at")

    challenge = FlashChallenge(
        tournament_id=body.tournament_id,
        match_id=body.match_id if body.scope != "open" else None,
        stage_id=body.stage_id if body.scope != "open" else None,
        scope=body.scope,
        title=body.title,
        description=body.description,
        type=body.type,
        participation_cost=body.participation_cost,
        reward_points=body.reward_points,
        open_at=open_at,
        close_at=close_at,
        resolution_method="manual",
        status="draft",
    )
    db.add(challenge)
    await db.flush()

    for idx, opt in enumerate(body.options):
        option = FlashChallengeOption(
            challenge_id=challenge.id,
            label=opt.label,
            order_index=idx,
        )
        db.add(option)

    audit = AuditLog(
        actor_id=admin.id,
        action="create_challenge",
        resource_type="flash_challenge",
        resource_id=challenge.id,
        after_state={
            "title": body.title,
            "type": body.type,
            "participation_cost": body.participation_cost,
            "reward_points": body.reward_points,
        },
    )
    db.add(audit)
    await db.commit()

    return {"id": str(challenge.id), "message": "Challenge created"}


# ── Update ───────────────────────────────────────────────────────────────────

@router.put("/{challenge_id}")
async def update_challenge(
    challenge_id: UUID,
    body: UpdateChallengeRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    admin: Annotated[User, Depends(require_admin)],
):
    result = await db.execute(select(FlashChallenge).where(FlashChallenge.id == challenge_id))
    challenge = result.scalar_one_or_none()
    if not challenge:
        raise HTTPException(status_code=404, detail="Challenge not found")

    before = {
        "title": challenge.title,
        "status": challenge.status,
        "participation_cost": challenge.participation_cost,
        "reward_points": challenge.reward_points,
    }
    if body.title is not None:
        challenge.title = body.title
    if body.description is not None:
        challenge.description = body.description
    if body.participation_cost is not None:
        # Only allow cost change if no participants yet
        ans_count = (await db.execute(
            select(func.count()).select_from(FlashChallengeAnswer)
            .where(FlashChallengeAnswer.challenge_id == challenge_id)
        )).scalar() or 0
        if ans_count > 0:
            raise HTTPException(status_code=400, detail="Cannot change cost after participants have joined")
        challenge.participation_cost = body.participation_cost
    if body.reward_points is not None:
        challenge.reward_points = body.reward_points
    if body.open_at is not None:
        challenge.open_at = datetime.fromisoformat(body.open_at)
    if body.close_at is not None:
        challenge.close_at = datetime.fromisoformat(body.close_at)
    if body.status is not None:
        valid = {"draft", "active", "locked", "cancelled"}
        if body.status not in valid:
            raise HTTPException(status_code=400, detail=f"Status must be one of {valid}")
        # Handle cancel → refund
        if body.status == "cancelled" and challenge.status != "cancelled":
            await _refund_all_participants(db, challenge, admin.id)
        challenge.status = body.status

    # ── Trigger activity + notifications on activation ──
    if body.status == "active" and before["status"] != "active":
        # Load challenge options for metadata
        opts_result = await db.execute(
            select(FlashChallengeOption)
            .where(FlashChallengeOption.challenge_id == challenge_id)
            .order_by(FlashChallengeOption.order_index)
        )
        opts = list(opts_result.scalars().all())
        t_result = await db.execute(
            select(Tournament.name).where(Tournament.id == challenge.tournament_id)
        )
        t_name = t_result.scalar_one_or_none() or "Tournament"

        await create_activity(
            db,
            activity_type="flash_challenge_published",
            title="⚡ New Flash Challenge",
            body=f"{challenge.title} · {challenge.participation_cost}pt entry · {challenge.reward_points}pts reward",
            actor_user_id=admin.id,
            related_entity_type="flash_challenge",
            related_entity_id=challenge.id,
            visibility="all_users",
            metadata={
                "challenge_id": str(challenge.id),
                "challenge_title": challenge.title,
                "challenge_description": challenge.description,
                "participation_cost": challenge.participation_cost,
                "reward_points": challenge.reward_points,
                "close_at": challenge.close_at.isoformat(),
                "type": challenge.type,
                "options": [{"id": str(o.id), "label": o.label} for o in opts],
                "tournament_name": t_name,
            },
        )

        # Notify all active users
        all_users = (await db.execute(
            select(User.id).where(User.is_active == True)
        )).all()
        user_ids = [row[0] for row in all_users]
        await notify_many(
            db,
            user_ids=user_ids,
            type=NotifType.FLASH_CHALLENGE_PUBLISHED,
            title="New Flash Challenge!",
            message=f"{challenge.title} — {challenge.reward_points}pts reward!",
            related_entity_type="flash_challenge",
            related_entity_id=challenge.id,
            action_url="/challenges",
            dedup_key=f"challenge_pub:{challenge.id}",
        )

    audit = AuditLog(
        actor_id=admin.id,
        action="update_challenge",
        resource_type="flash_challenge",
        resource_id=challenge.id,
        before_state=before,
        after_state={
            "title": challenge.title,
            "status": challenge.status,
            "participation_cost": challenge.participation_cost,
            "reward_points": challenge.reward_points,
        },
    )
    db.add(audit)
    await db.commit()

    return {"message": "Challenge updated"}


# ── Resolve ──────────────────────────────────────────────────────────────────

@router.post("/{challenge_id}/resolve")
async def resolve_challenge(
    challenge_id: UUID,
    body: ResolveChallengeRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    admin: Annotated[User, Depends(require_admin)],
):
    result = await db.execute(select(FlashChallenge).where(FlashChallenge.id == challenge_id))
    challenge = result.scalar_one_or_none()
    if not challenge:
        raise HTTPException(status_code=404, detail="Challenge not found")
    if challenge.status == "resolved":
        raise HTTPException(status_code=400, detail="Already resolved")
    if challenge.status == "cancelled":
        raise HTTPException(status_code=400, detail="Cannot resolve a cancelled challenge")

    # Verify the option belongs to this challenge
    correct_opt = (await db.execute(
        select(FlashChallengeOption).where(
            FlashChallengeOption.id == body.correct_option_id,
            FlashChallengeOption.challenge_id == challenge_id,
        )
    )).scalar_one_or_none()
    if not correct_opt:
        raise HTTPException(status_code=400, detail="Option not found for this challenge")

    now = datetime.now(timezone.utc)
    challenge.correct_option_id = body.correct_option_id
    challenge.resolved_at = now
    challenge.status = "resolved"

    # Load all answers
    all_answers = list((await db.execute(
        select(FlashChallengeAnswer).where(
            FlashChallengeAnswer.challenge_id == challenge_id
        )
    )).scalars().all())

    winners = 0
    losers = 0

    for ans in all_answers:
        # Idempotent: skip already-resolved answers
        if ans.outcome_status in ("won", "lost"):
            if ans.outcome_status == "won":
                winners += 1
            else:
                losers += 1
            continue

        if ans.option_id == body.correct_option_id:
            # Winner: award reward_points
            ans.outcome_status = "won"
            ans.reward_points_awarded = challenge.reward_points

            # Update challenge_points_balance with row lock
            profile = (await db.execute(
                select(UserProfile)
                .where(UserProfile.user_id == ans.user_id)
                .with_for_update()
            )).scalar_one_or_none()
            if profile:
                profile.challenge_points_balance += challenge.reward_points
                new_balance = _available_balance(profile)

                ledger = PointsLedger(
                    user_id=ans.user_id,
                    transaction_type="challenge_reward",
                    reference_type="flash_challenge",
                    reference_id=challenge_id,
                    points_delta=challenge.reward_points,
                    balance_after=new_balance,
                    metadata_json={
                        "challenge_title": challenge.title,
                        "reward": challenge.reward_points,
                    },
                )
                db.add(ledger)

            await notify(
                db,
                user_id=ans.user_id,
                type=NotifType.CHALLENGE_WON,
                title="Challenge Won!",
                message=f'You won "{challenge.title}" and earned {challenge.reward_points} points!',
                related_entity_type="flash_challenge",
                related_entity_id=challenge_id,
                action_url="/challenges",
                dedup_key=f"challenge_won:{challenge_id}:{ans.user_id}",
            )
            winners += 1
        else:
            # Loser: already paid on entry, just mark outcome
            ans.outcome_status = "lost"
            ans.reward_points_awarded = 0

            await notify(
                db,
                user_id=ans.user_id,
                type=NotifType.CHALLENGE_LOST,
                title="Challenge Lost",
                message=f'You lost "{challenge.title}". The correct answer was: {correct_opt.label}.',
                related_entity_type="flash_challenge",
                related_entity_id=challenge_id,
                action_url="/challenges",
                dedup_key=f"challenge_lost:{challenge_id}:{ans.user_id}",
            )
            losers += 1

    audit = AuditLog(
        actor_id=admin.id,
        action="resolve_challenge",
        resource_type="flash_challenge",
        resource_id=challenge.id,
        after_state={
            "correct_option": correct_opt.label,
            "winners": winners,
            "losers": losers,
            "reward_points": challenge.reward_points,
        },
    )
    db.add(audit)
    await db.commit()

    return {
        "message": "Challenge resolved",
        "winners": winners,
        "losers": losers,
        "reward_points": challenge.reward_points,
    }


# ── Cancel (with refund) ────────────────────────────────────────────────────

@router.post("/{challenge_id}/cancel")
async def cancel_challenge(
    challenge_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    admin: Annotated[User, Depends(require_admin)],
):
    result = await db.execute(select(FlashChallenge).where(FlashChallenge.id == challenge_id))
    challenge = result.scalar_one_or_none()
    if not challenge:
        raise HTTPException(status_code=404, detail="Challenge not found")
    if challenge.status == "resolved":
        raise HTTPException(status_code=400, detail="Cannot cancel a resolved challenge")
    if challenge.status == "cancelled":
        raise HTTPException(status_code=400, detail="Already cancelled")

    refunded = await _refund_all_participants(db, challenge, admin.id)
    challenge.status = "cancelled"

    audit = AuditLog(
        actor_id=admin.id,
        action="cancel_challenge",
        resource_type="flash_challenge",
        resource_id=challenge.id,
        after_state={"refunded_count": refunded},
    )
    db.add(audit)
    await db.commit()

    return {"message": "Challenge cancelled", "participants_refunded": refunded}


async def _refund_all_participants(
    db: AsyncSession, challenge: FlashChallenge, admin_id: UUID
) -> int:
    """Refund participation_cost to all non-refunded participants."""
    answers = list((await db.execute(
        select(FlashChallengeAnswer).where(
            FlashChallengeAnswer.challenge_id == challenge.id,
            FlashChallengeAnswer.outcome_status != "refunded",
        )
    )).scalars().all())

    refunded = 0
    for ans in answers:
        cost = ans.paid_points
        if cost <= 0:
            ans.outcome_status = "refunded"
            continue

        profile = (await db.execute(
            select(UserProfile)
            .where(UserProfile.user_id == ans.user_id)
            .with_for_update()
        )).scalar_one_or_none()
        if profile:
            profile.challenge_points_balance += cost
            new_balance = _available_balance(profile)

            ledger = PointsLedger(
                user_id=ans.user_id,
                transaction_type="challenge_refund",
                reference_type="flash_challenge",
                reference_id=challenge.id,
                points_delta=cost,
                balance_after=new_balance,
                metadata_json={
                    "challenge_title": challenge.title,
                    "refund": cost,
                },
            )
            db.add(ledger)

        ans.outcome_status = "refunded"
        refunded += 1

        await notify(
            db,
            user_id=ans.user_id,
            type=NotifType.CHALLENGE_REFUNDED,
            title="Challenge Refunded",
            message=f'"{challenge.title}" was cancelled. Your {cost} points have been refunded.',
            related_entity_type="flash_challenge",
            related_entity_id=challenge.id,
            action_url="/challenges",
            dedup_key=f"challenge_refund:{challenge.id}:{ans.user_id}",
        )

    return refunded


# ── Participants ─────────────────────────────────────────────────────────────

@router.get("/{challenge_id}/participants")
async def challenge_participants(
    challenge_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    admin: Annotated[User, Depends(require_admin)],
):
    """View all participants and their outcomes for a challenge."""
    challenge = (await db.execute(
        select(FlashChallenge).where(FlashChallenge.id == challenge_id)
    )).scalar_one_or_none()
    if not challenge:
        raise HTTPException(status_code=404, detail="Challenge not found")

    answers = list((await db.execute(
        select(FlashChallengeAnswer)
        .where(FlashChallengeAnswer.challenge_id == challenge_id)
        .order_by(FlashChallengeAnswer.submitted_at)
    )).scalars().all())

    # Fetch user profiles and option labels
    user_ids = [a.user_id for a in answers]
    option_ids = list({a.option_id for a in answers})

    profiles_map = {}
    if user_ids:
        profiles = (await db.execute(
            select(UserProfile).where(UserProfile.user_id.in_(user_ids))
        )).scalars().all()
        profiles_map = {p.user_id: p.display_name for p in profiles}

    options_map = {}
    if option_ids:
        opts = (await db.execute(
            select(FlashChallengeOption).where(FlashChallengeOption.id.in_(option_ids))
        )).scalars().all()
        options_map = {o.id: o.label for o in opts}

    data = []
    for a in answers:
        data.append({
            "user_id": str(a.user_id),
            "display_name": profiles_map.get(a.user_id, "Unknown"),
            "option_id": str(a.option_id),
            "option_label": options_map.get(a.option_id, "?"),
            "paid_points": a.paid_points,
            "reward_points_awarded": a.reward_points_awarded,
            "outcome_status": a.outcome_status,
            "submitted_at": a.submitted_at.isoformat(),
        })

    return {
        "challenge_id": str(challenge_id),
        "title": challenge.title,
        "participation_cost": challenge.participation_cost,
        "reward_points": challenge.reward_points,
        "status": challenge.status,
        "participants": data,
        "total": len(data),
    }


# ── Delete ───────────────────────────────────────────────────────────────────

@router.delete("/{challenge_id}")
async def delete_challenge(
    challenge_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    admin: Annotated[User, Depends(require_admin)],
):
    result = await db.execute(select(FlashChallenge).where(FlashChallenge.id == challenge_id))
    challenge = result.scalar_one_or_none()
    if not challenge:
        raise HTTPException(status_code=404, detail="Challenge not found")

    # Check if any participants have paid — must cancel (refund) first
    has_paid = (await db.execute(
        select(func.count()).select_from(FlashChallengeAnswer)
        .where(
            FlashChallengeAnswer.challenge_id == challenge_id,
            FlashChallengeAnswer.paid_points > 0,
            FlashChallengeAnswer.outcome_status != "refunded",
        )
    )).scalar() or 0
    if has_paid > 0:
        raise HTTPException(
            status_code=400,
            detail="Cannot delete challenge with un-refunded participants. Cancel first to refund.",
        )

    await db.execute(
        sql_delete(FlashChallengeAnswer).where(FlashChallengeAnswer.challenge_id == challenge_id)
    )
    await db.execute(
        sql_delete(FlashChallengeOption).where(FlashChallengeOption.challenge_id == challenge_id)
    )
    await db.execute(
        sql_delete(FlashChallenge).where(FlashChallenge.id == challenge_id)
    )

    audit = AuditLog(
        actor_id=admin.id,
        action="delete_challenge",
        resource_type="flash_challenge",
        resource_id=challenge_id,
        before_state={"title": challenge.title},
    )
    db.add(audit)
    await db.commit()

    return {"message": "Challenge deleted"}
