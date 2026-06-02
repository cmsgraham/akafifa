"""In-app notification endpoints — list, read, mark-all-read, unread count."""

from datetime import datetime, timezone
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user
from app.db.models import InAppNotification, User
from app.db.session import get_db

router = APIRouter(prefix="/api/me/notifications", tags=["notifications"])


@router.get("")
async def list_notifications(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    category: str | None = Query(None),
    limit: int = Query(30, ge=1, le=100),
    cursor: str | None = Query(None),
):
    """Paginated list of the current user's notifications (newest first)."""
    query = (
        select(InAppNotification)
        .where(
            InAppNotification.user_id == current_user.id,
            InAppNotification.status != "archived",
        )
    )
    if category:
        query = query.where(InAppNotification.category == category)
    if cursor:
        query = query.where(InAppNotification.created_at < datetime.fromisoformat(cursor))

    query = query.order_by(InAppNotification.created_at.desc()).limit(limit + 1)
    rows = list((await db.execute(query)).scalars().all())

    has_more = len(rows) > limit
    rows = rows[:limit]

    data = [
        {
            "id": str(n.id),
            "category": n.category,
            "type": n.type,
            "title": n.title,
            "message": n.message,
            "priority": n.priority,
            "status": n.status,
            "action_url": n.action_url,
            "data": n.data,
            "created_at": n.created_at.isoformat(),
            "read_at": n.read_at.isoformat() if n.read_at else None,
        }
        for n in rows
    ]

    next_cursor = data[-1]["created_at"] if data and has_more else None
    return {"data": data, "pagination": {"next_cursor": next_cursor, "has_more": has_more}}


@router.get("/unread-count")
async def unread_count(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    count = (await db.execute(
        select(func.count()).select_from(InAppNotification).where(
            InAppNotification.user_id == current_user.id,
            InAppNotification.status == "unread",
        )
    )).scalar_one()
    return {"unread_count": count}


@router.post("/{notification_id}/read")
async def mark_read(
    notification_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    notif = (await db.execute(
        select(InAppNotification).where(
            InAppNotification.id == notification_id,
            InAppNotification.user_id == current_user.id,
        )
    )).scalar_one_or_none()
    if not notif:
        raise HTTPException(status_code=404, detail="Notification not found")
    if notif.status == "unread":
        notif.status = "read"
        notif.read_at = datetime.now(timezone.utc)
        await db.commit()
    return {"status": "read"}


@router.post("/mark-all-read")
async def mark_all_read(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    now = datetime.now(timezone.utc)
    result = await db.execute(
        update(InAppNotification)
        .where(
            InAppNotification.user_id == current_user.id,
            InAppNotification.status == "unread",
        )
        .values(status="read", read_at=now)
    )
    await db.commit()
    return {"marked_read": result.rowcount}
