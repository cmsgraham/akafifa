"""User-facing support ticket endpoints."""

import logging
from datetime import datetime, timezone
from typing import Literal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user
from app.db.models import User, SupportTicket, UserProfile
from app.db.session import get_db
from app.services.email.sender import send_email, load_template

logger = logging.getLogger("uvicorn.error")

router = APIRouter(prefix="/api", tags=["support"])

CATEGORIES = ("general", "bug", "account", "scoring", "suggestion")


class TicketCreate(BaseModel):
    subject: str = Field(..., min_length=3, max_length=200)
    body: str = Field(..., min_length=10, max_length=5000)
    category: Literal["general", "bug", "account", "scoring", "suggestion"] = "general"


class TicketOut(BaseModel):
    id: str
    subject: str
    body: str
    category: str
    status: str
    admin_reply: str | None = None
    replied_at: str | None = None
    created_at: str
    updated_at: str


@router.post("/me/tickets", status_code=201)
async def create_ticket(
    body: TicketCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Rate limit: max 5 open tickets per user
    count_result = await db.execute(
        select(func.count()).where(
            SupportTicket.user_id == current_user.id,
            SupportTicket.status.in_(["open", "in_progress"]),
        )
    )
    open_count = count_result.scalar() or 0
    if open_count >= 5:
        raise HTTPException(
            status_code=429,
            detail="You have too many open tickets. Please wait for existing ones to be resolved.",
        )

    ticket = SupportTicket(
        user_id=current_user.id,
        subject=body.subject,
        body=body.body,
        category=body.category,
    )
    db.add(ticket)
    await db.commit()
    await db.refresh(ticket)

    # Email all admins
    try:
        admin_result = await db.execute(
            select(User.email).where(User.role == "admin", User.is_active == True)
        )
        admin_emails = [row[0] for row in admin_result.all()]

        # Get display name
        prof_result = await db.execute(
            select(UserProfile.display_name).where(UserProfile.user_id == current_user.id)
        )
        display_name = (prof_result.scalar() or current_user.email.split("@")[0])

        email_body = load_template(
            "new_ticket.txt",
            display_name=display_name,
            email=current_user.email,
            category=body.category,
            subject=body.subject,
            body=body.body,
        )
        for admin_email in admin_emails:
            send_email(admin_email, f"[REDZONE] New Ticket: {body.subject}", email_body)
    except Exception as e:
        logger.warning(f"Failed to send ticket notification email: {e}")

    return {
        "id": str(ticket.id),
        "subject": ticket.subject,
        "status": ticket.status,
        "created_at": ticket.created_at.isoformat(),
    }


@router.get("/me/tickets")
async def list_my_tickets(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(SupportTicket)
        .where(SupportTicket.user_id == current_user.id)
        .order_by(SupportTicket.created_at.desc())
        .limit(50)
    )
    tickets = result.scalars().all()

    return {
        "data": [
            TicketOut(
                id=str(t.id),
                subject=t.subject,
                body=t.body,
                category=t.category,
                status=t.status,
                admin_reply=t.admin_reply,
                replied_at=t.replied_at.isoformat() if t.replied_at else None,
                created_at=t.created_at.isoformat(),
                updated_at=t.updated_at.isoformat(),
            )
            for t in tickets
        ]
    }
