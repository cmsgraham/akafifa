from datetime import datetime, timezone
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import require_admin
from app.db.models import AuditLog, Stage, User
from app.db.session import get_db

router = APIRouter(prefix="/api/admin/stages", tags=["admin-stages"])


@router.post("/{stage_id}/freeze")
async def freeze_stage(
    stage_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    admin: Annotated[User, Depends(require_admin)],
):
    """Freeze a stage — its leaderboard becomes a read-only snapshot."""
    result = await db.execute(select(Stage).where(Stage.id == stage_id))
    stage = result.scalar_one_or_none()
    if not stage:
        raise HTTPException(status_code=404, detail="Stage not found")
    if stage.is_frozen:
        raise HTTPException(status_code=400, detail="Stage is already frozen")

    stage.is_frozen = True
    stage.frozen_at = datetime.now(timezone.utc)

    audit = AuditLog(
        actor_id=admin.id,
        action="freeze_stage",
        resource_type="stage",
        resource_id=stage.id,
        after_state={"name": stage.name, "frozen_at": stage.frozen_at.isoformat()},
    )
    db.add(audit)

    return {"message": f"Stage '{stage.name}' frozen", "frozen_at": stage.frozen_at.isoformat()}
