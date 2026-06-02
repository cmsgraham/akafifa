"""Activity feed service — create typed activity items for the social feed."""

import logging
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import ActivityItem, Comment

logger = logging.getLogger(__name__)


async def create_activity(
    db: AsyncSession,
    *,
    activity_type: str,
    title: str,
    body: str | None = None,
    actor_user_id: UUID | None = None,
    related_entity_type: str | None = None,
    related_entity_id: UUID | None = None,
    visibility: str = "all_users",
    participant1_id: UUID | None = None,
    participant2_id: UUID | None = None,
    metadata: dict | None = None,
) -> ActivityItem | None:
    """Create an activity item with a linked Comment for reactions/replies.
    Returns None if a duplicate already exists."""

    # Dedup check: one activity per entity + type
    if related_entity_type and related_entity_id:
        existing = (await db.execute(
            select(ActivityItem.id).where(
                ActivityItem.related_entity_type == related_entity_type,
                ActivityItem.related_entity_id == related_entity_id,
                ActivityItem.activity_type == activity_type,
            )
        )).scalar_one_or_none()
        if existing:
            logger.debug("Duplicate activity %s for %s/%s — skipped",
                         activity_type, related_entity_type, related_entity_id)
            return None

    # Create a backing Comment so the activity supports reactions + replies
    comment = None
    if actor_user_id:
        comment = Comment(
            user_id=actor_user_id,
            body=title,
            match_id=None,
            parent_id=None,
        )
        db.add(comment)
        await db.flush()  # get comment.id

    item = ActivityItem(
        actor_user_id=actor_user_id,
        activity_type=activity_type,
        title=title,
        body=body,
        related_entity_type=related_entity_type,
        related_entity_id=related_entity_id,
        visibility=visibility,
        participant1_id=participant1_id,
        participant2_id=participant2_id,
        metadata_=metadata,
        comment_id=comment.id if comment else None,
    )
    db.add(item)
    return item
