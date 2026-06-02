from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from app.core.dependencies import require_admin
from app.db.models import AuditLog, User
from app.db.session import get_db

router = APIRouter(prefix="/api/admin", tags=["admin-audit"])


@router.get("/audit-logs")
async def list_audit_logs(
    db: Annotated[AsyncSession, Depends(get_db)],
    _admin: Annotated[User, Depends(require_admin)],
    user_id: UUID | None = Query(None),
    limit: int = Query(20, ge=1, le=100),
    cursor: str | None = Query(None),
):
    """Paginated audit logs, filterable by user_id."""
    query = select(AuditLog).order_by(AuditLog.created_at.desc())

    if user_id:
        query = query.where(AuditLog.actor_id == user_id)

    if cursor:
        from datetime import datetime, timezone
        try:
            cursor_dt = datetime.fromisoformat(cursor)
            query = query.where(AuditLog.created_at < cursor_dt)
        except ValueError:
            pass

    query = query.limit(limit + 1)
    result = await db.execute(query)
    logs = list(result.scalars().all())

    has_more = len(logs) > limit
    if has_more:
        logs = logs[:limit]

    next_cursor = logs[-1].created_at.isoformat() if has_more and logs else None

    # Batch-load actor names
    actor_ids = {log.actor_id for log in logs if log.actor_id}
    actor_names: dict[UUID, str] = {}
    if actor_ids:
        from app.db.models import UserProfile
        name_q = select(User.id, UserProfile.display_name).join(
            UserProfile, UserProfile.user_id == User.id, isouter=True
        ).where(User.id.in_(actor_ids))
        name_result = await db.execute(name_q)
        for uid, dname in name_result.all():
            actor_names[uid] = dname or "Unknown"

    return {
        "data": [
            {
                "id": str(log.id),
                "actor_id": str(log.actor_id) if log.actor_id else None,
                "actor_name": actor_names.get(log.actor_id) if log.actor_id else None,
                "action": log.action,
                "resource_type": log.resource_type,
                "resource_id": str(log.resource_id) if log.resource_id else None,
                "before_state": log.before_state,
                "after_state": log.after_state,
                "ip_address": log.ip_address,
                "created_at": log.created_at.isoformat(),
            }
            for log in logs
        ],
        "pagination": {
            "next_cursor": next_cursor,
            "has_more": has_more,
        },
    }
