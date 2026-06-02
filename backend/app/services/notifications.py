"""Notification service — in-app + email notification layer.

In-app notifications are created via `notify()` / `notify_many()`.
Email is handled by the existing `create_notification()` helper.
"""

import logging
from datetime import datetime, timedelta, timezone
from uuid import UUID

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import InAppNotification, Notification, OutboundEmailJob, User

logger = logging.getLogger(__name__)

# ── Dedup ────────────────────────────────────────────────────────────────────
DEDUP_WINDOW_SECONDS = 300  # 5 min — same dedup_key for same user is suppressed


# ── Notification type constants ──────────────────────────────────────────────

class NotifType:
    # Social
    COMMENT_REPLY = "comment_reply"
    COMMENT_MENTION = "comment_mention"
    NEW_FOLLOWER = "new_follower"
    FOLLOWER_POST = "follower_post"
    # Duels
    DUEL_INVITATION = "duel_invitation"
    DUEL_ACCEPTED = "duel_accepted"
    DUEL_DECLINED = "duel_declined"
    DUEL_EXPIRED = "duel_expired"
    DUEL_WON = "duel_won"
    DUEL_LOST = "duel_lost"
    DUEL_DRAW = "duel_draw"
    # Challenges
    FLASH_CHALLENGE_PUBLISHED = "flash_challenge_published"
    CHALLENGE_WON = "challenge_won"
    CHALLENGE_LOST = "challenge_lost"
    CHALLENGE_REFUNDED = "challenge_refunded"
    # Match / Prediction
    PREDICTION_SCORED = "prediction_scored"
    # System
    WELCOME = "welcome"
    ADMIN_ANNOUNCEMENT = "admin_announcement"


_TYPE_CATEGORY: dict[str, str] = {
    NotifType.COMMENT_REPLY: "social",
    NotifType.COMMENT_MENTION: "social",
    NotifType.NEW_FOLLOWER: "social",
    NotifType.FOLLOWER_POST: "social",
    NotifType.DUEL_INVITATION: "duel",
    NotifType.DUEL_ACCEPTED: "duel",
    NotifType.DUEL_DECLINED: "duel",
    NotifType.DUEL_EXPIRED: "duel",
    NotifType.DUEL_WON: "duel",
    NotifType.DUEL_LOST: "duel",
    NotifType.DUEL_DRAW: "duel",
    NotifType.FLASH_CHALLENGE_PUBLISHED: "challenge",
    NotifType.CHALLENGE_WON: "challenge",
    NotifType.CHALLENGE_LOST: "challenge",
    NotifType.CHALLENGE_REFUNDED: "challenge",
    NotifType.PREDICTION_SCORED: "match",
    NotifType.WELCOME: "system",
    NotifType.ADMIN_ANNOUNCEMENT: "system",
}

_TYPE_PRIORITY: dict[str, str] = {
    NotifType.DUEL_INVITATION: "high",
    NotifType.FLASH_CHALLENGE_PUBLISHED: "high",
    NotifType.DUEL_WON: "high",
    NotifType.DUEL_LOST: "high",
    NotifType.CHALLENGE_WON: "high",
    NotifType.CHALLENGE_LOST: "high",
}

# Types that also trigger an email (in addition to in-app notification)
_EMAIL_TYPES: set[str] = {
    NotifType.DUEL_INVITATION,
    NotifType.DUEL_WON,
    NotifType.DUEL_LOST,
    NotifType.DUEL_DRAW,
    NotifType.CHALLENGE_WON,
    NotifType.CHALLENGE_REFUNDED,
    NotifType.PREDICTION_SCORED,
}


# ── Core helpers ─────────────────────────────────────────────────────────────

async def notify(
    db: AsyncSession,
    *,
    user_id: UUID,
    type: str,
    title: str,
    message: str,
    actor_user_id: UUID | None = None,
    related_entity_type: str | None = None,
    related_entity_id: UUID | None = None,
    action_url: str | None = None,
    data: dict | None = None,
    dedup_key: str | None = None,
    priority: str | None = None,
    expires_at: datetime | None = None,
) -> InAppNotification | None:
    """Create an in-app notification. Returns None if suppressed by dedup."""
    category = _TYPE_CATEGORY.get(type, "system")
    if priority is None:
        priority = _TYPE_PRIORITY.get(type, "normal")

    if dedup_key:
        cutoff = datetime.now(timezone.utc) - timedelta(seconds=DEDUP_WINDOW_SECONDS)
        existing = (await db.execute(
            select(func.count()).select_from(InAppNotification).where(
                InAppNotification.dedup_key == dedup_key,
                InAppNotification.user_id == user_id,
                InAppNotification.created_at > cutoff,
            )
        )).scalar_one()
        if existing > 0:
            return None

    notif = InAppNotification(
        user_id=user_id,
        category=category,
        type=type,
        title=title,
        message=message,
        priority=priority,
        actor_user_id=actor_user_id,
        related_entity_type=related_entity_type,
        related_entity_id=related_entity_id,
        action_url=action_url,
        data=data,
        dedup_key=dedup_key,
        expires_at=expires_at,
    )
    db.add(notif)

    # Auto-enqueue email for important notification types
    if type in _EMAIL_TYPES:
        try:
            user = (await db.execute(
                select(User).where(User.id == user_id)
            )).scalar_one_or_none()
            if user and user.email:
                db.add(OutboundEmailJob(
                    to_address=user.email,
                    subject=f"REDZONE — {title}",
                    body=f"{title}\n\n{message}\n\nhttps://redzone-soccer.com{action_url or ''}\n\n— REDZONE",
                ))
        except Exception as e:
            logger.warning("Failed to enqueue email for notification %s: %s", type, e)

    return notif


async def notify_many(
    db: AsyncSession,
    *,
    user_ids: list[UUID],
    type: str,
    title: str,
    message: str,
    **kwargs,
) -> int:
    """Send the same notification to multiple users. Returns count created."""
    count = 0
    for uid in user_ids:
        result = await notify(db, user_id=uid, type=type, title=title, message=message, **kwargs)
        if result:
            count += 1
    return count


# ── Email helper (unchanged) ────────────────────────────────────────────────

async def create_notification(
    *,
    user_id: UUID,
    type: str,
    title: str,
    body: str,
    channel: str = "email",
    metadata: dict | None = None,
    to_address: str | None = None,
    subject: str | None = None,
    db: AsyncSession,
) -> Notification:
    """Create an email notification record and enqueue delivery job."""
    notification = Notification(
        user_id=user_id,
        type=type,
        title=title,
        body=body,
        channel=channel,
        extra_data=metadata,
    )
    db.add(notification)
    await db.flush()

    if channel == "email" and to_address and subject:
        email_job = OutboundEmailJob(
            notification_id=notification.id,
            to_address=to_address,
            subject=subject,
            body=body,
        )
        db.add(email_job)

    return notification
