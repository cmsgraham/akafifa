from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import require_admin
from app.db.models import Comment, AuditLog, User
from app.db.session import get_db
from datetime import datetime, timezone

router = APIRouter(prefix="/api/admin/comments", tags=["admin-comments"])


@router.delete("/{comment_id}")
async def admin_delete_comment(
    comment_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    admin: Annotated[User, Depends(require_admin)],
):
    """Admin moderation: delete any comment regardless of grace period."""
    result = await db.execute(select(Comment).where(Comment.id == comment_id))
    comment = result.scalar_one_or_none()
    if not comment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Comment not found")

    comment.is_deleted = True
    comment.deleted_by = admin.id
    comment.deleted_at = datetime.now(timezone.utc)

    audit = AuditLog(
        actor_id=admin.id,
        action="delete_comment",
        resource_type="comment",
        resource_id=comment.id,
    )
    db.add(audit)

    return {"message": "Comment deleted"}
