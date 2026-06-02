"""Admin support ticket management."""

import logging
from datetime import datetime, timezone
from typing import Literal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from app.core.dependencies import get_current_user, require_admin
from app.db.models import User, SupportTicket, UserProfile
from app.db.session import get_db
from app.services.email.sender import send_email, load_template

logger = logging.getLogger("uvicorn.error")

router = APIRouter(prefix="/api/admin/tickets", tags=["admin-tickets"])


class TicketReply(BaseModel):
    reply: str = Field(..., min_length=1, max_length=5000)
    status: Literal["open", "in_progress", "resolved", "closed"] = "resolved"


@router.get("")
async def list_tickets(
    status: str | None = Query(None),
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin),
):
    q = select(SupportTicket).join(User, SupportTicket.user_id == User.id)

    if status:
        q = q.where(SupportTicket.status == status)

    # Count
    count_q = select(func.count()).select_from(q.subquery())
    total = (await db.execute(count_q)).scalar() or 0

    q = q.order_by(SupportTicket.created_at.desc())
    q = q.offset((page - 1) * per_page).limit(per_page)

    result = await db.execute(q)
    tickets = result.scalars().all()

    # Collect user info
    user_ids = {t.user_id for t in tickets}
    if user_ids:
        profiles_result = await db.execute(
            select(UserProfile).where(UserProfile.user_id.in_(user_ids))
        )
        profiles = {p.user_id: p for p in profiles_result.scalars().all()}
        users_result = await db.execute(
            select(User).where(User.id.in_(user_ids))
        )
        users = {u.id: u for u in users_result.scalars().all()}
    else:
        profiles = {}
        users = {}

    return {
        "data": [
            {
                "id": str(t.id),
                "user_id": str(t.user_id),
                "user_email": users.get(t.user_id, None) and users[t.user_id].email,
                "display_name": profiles.get(t.user_id, None) and profiles[t.user_id].display_name,
                "subject": t.subject,
                "body": t.body,
                "category": t.category,
                "status": t.status,
                "admin_reply": t.admin_reply,
                "replied_at": t.replied_at.isoformat() if t.replied_at else None,
                "created_at": t.created_at.isoformat(),
            }
            for t in tickets
        ],
        "total": total,
        "page": page,
        "per_page": per_page,
    }


@router.put("/{ticket_id}")
async def reply_ticket(
    ticket_id: UUID,
    body: TicketReply,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin),
):
    result = await db.execute(
        select(SupportTicket).where(SupportTicket.id == ticket_id)
    )
    ticket = result.scalar_one_or_none()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")

    ticket.admin_reply = body.reply
    ticket.status = body.status
    ticket.replied_at = datetime.now(timezone.utc)
    ticket.replied_by = admin.id

    await db.commit()

    # Email the ticket owner
    try:
        user_result = await db.execute(select(User).where(User.id == ticket.user_id))
        ticket_user = user_result.scalar_one_or_none()
        if ticket_user:
            prof_result = await db.execute(
                select(UserProfile.display_name).where(UserProfile.user_id == ticket.user_id)
            )
            display_name = prof_result.scalar() or ticket_user.email.split("@")[0]

            status_labels = {"open": "Open", "in_progress": "In Progress", "resolved": "Resolved", "closed": "Closed"}
            email_body = load_template(
                "ticket_reply.txt",
                display_name=display_name,
                subject=ticket.subject,
                status=status_labels.get(body.status, body.status),
                reply=body.reply,
            )
            send_email(ticket_user.email, f"[REDZONE] Ticket Update: {ticket.subject}", email_body)
    except Exception as e:
        logger.warning(f"Failed to send ticket reply email: {e}")

    return {"message": "Ticket updated", "status": ticket.status}


@router.get("/stats")
async def ticket_stats(
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin),
):
    result = await db.execute(
        select(SupportTicket.status, func.count()).group_by(SupportTicket.status)
    )
    counts = {row[0]: row[1] for row in result.all()}
    return {
        "open": counts.get("open", 0),
        "in_progress": counts.get("in_progress", 0),
        "resolved": counts.get("resolved", 0),
        "closed": counts.get("closed", 0),
        "total": sum(counts.values()),
    }
