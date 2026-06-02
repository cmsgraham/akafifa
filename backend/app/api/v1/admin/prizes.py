from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import require_admin
from app.db.models import Prize, AuditLog, User
from app.db.session import get_db

router = APIRouter(prefix="/api/admin/prizes", tags=["admin-prizes"])


class CreatePrizeRequest(BaseModel):
    tournament_id: UUID
    stage_id: UUID | None = None
    title: str
    description: str | None = None


class UpdatePrizeRequest(BaseModel):
    title: str | None = None
    description: str | None = None
    winner_user_id: UUID | None = None


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_prize(
    body: CreatePrizeRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    admin: Annotated[User, Depends(require_admin)],
):
    prize = Prize(
        tournament_id=body.tournament_id,
        stage_id=body.stage_id,
        title=body.title,
        description=body.description,
    )
    db.add(prize)
    await db.flush()

    audit = AuditLog(
        actor_id=admin.id,
        action="create_prize",
        resource_type="prize",
        resource_id=prize.id,
        after_state={"title": body.title},
    )
    db.add(audit)

    return {"id": str(prize.id), "title": prize.title}


@router.put("/{prize_id}")
async def update_prize(
    prize_id: UUID,
    body: UpdatePrizeRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    admin: Annotated[User, Depends(require_admin)],
):
    result = await db.execute(select(Prize).where(Prize.id == prize_id))
    prize = result.scalar_one_or_none()
    if not prize:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Prize not found")

    before = {"title": prize.title, "description": prize.description}

    if body.title is not None:
        prize.title = body.title
    if body.description is not None:
        prize.description = body.description
    if body.winner_user_id is not None:
        from datetime import datetime, timezone
        prize.winner_user_id = body.winner_user_id
        prize.awarded_at = datetime.now(timezone.utc)

    audit = AuditLog(
        actor_id=admin.id,
        action="update_prize",
        resource_type="prize",
        resource_id=prize.id,
        before_state=before,
        after_state={"title": prize.title, "description": prize.description},
    )
    db.add(audit)

    return {"id": str(prize.id), "title": prize.title}
