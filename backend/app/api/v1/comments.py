from datetime import datetime, timezone
from typing import Annotated
from uuid import UUID
import re
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field, model_validator
from sqlalchemy import func, select, and_, or_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import aliased

from app.core.config import settings
from app.core.dependencies import get_current_user, require_admin
from app.db.models import ActivityItem, Comment, CommentReaction, Match, Stage, Team, User, UserProfile, UserFollow
from app.db.session import get_db


def _allowed_media_host() -> str:
    """Return the hostname prefix that media URLs must start with."""
    ep = settings.S3_ENDPOINT_URL.rstrip("/")
    bucket = settings.MEDIA_BUCKET
    return f"{ep}/{bucket}/" if ep and bucket else ""


_GIPHY_URL_RE = re.compile(r"^https://media[0-9]*\.giphy\.com/")


def _validate_media_url(url: str | None) -> str | None:
    if url is None:
        return None
    url = url.strip()
    if not url:
        return None
    prefix = _allowed_media_host()
    if prefix and url.startswith(prefix):
        return url
    if _GIPHY_URL_RE.match(url):
        return url
    raise ValueError(f"media_url must start with {prefix} or be a GIPHY CDN URL")
from app.services.notifications import notify, NotifType

router = APIRouter(prefix="/api", tags=["comments"])

EDIT_GRACE_SECONDS = 300  # 5 minutes
MENTION_REGEX = re.compile(r"@(\w[\w ]{0,48}\w|\w)")


def extract_mentions(text: str) -> list[str]:
    """Extract @mentioned display names from text."""
    return MENTION_REGEX.findall(text)


async def _get_reactions_map(db: AsyncSession, comment_ids: list[uuid.UUID]) -> dict:
    """Return {comment_id: {emoji: count, ...}} for the given IDs."""
    if not comment_ids:
        return {}
    result = await db.execute(
        select(
            CommentReaction.comment_id,
            CommentReaction.emoji,
            func.count().label("cnt"),
        )
        .where(CommentReaction.comment_id.in_(comment_ids))
        .group_by(CommentReaction.comment_id, CommentReaction.emoji)
    )
    rmap: dict = {}
    for row in result.all():
        cid = str(row.comment_id)
        if cid not in rmap:
            rmap[cid] = {}
        rmap[cid][row.emoji] = row.cnt
    return rmap


async def _get_user_reactions(db: AsyncSession, comment_ids: list[uuid.UUID], user_id: uuid.UUID) -> dict:
    """Return {comment_id: [emoji, ...]} for the user's own reactions."""
    if not comment_ids or not user_id:
        return {}
    result = await db.execute(
        select(CommentReaction.comment_id, CommentReaction.emoji)
        .where(CommentReaction.comment_id.in_(comment_ids), CommentReaction.user_id == user_id)
    )
    umap: dict = {}
    for row in result.all():
        cid = str(row.comment_id)
        if cid not in umap:
            umap[cid] = []
        umap[cid].append(row.emoji)
    return umap


async def _get_reply_counts(db: AsyncSession, comment_ids: list[uuid.UUID]) -> dict:
    """Return {comment_id: reply_count} for the given IDs."""
    if not comment_ids:
        return {}
    result = await db.execute(
        select(Comment.parent_id, func.count().label("cnt"))
        .where(Comment.parent_id.in_(comment_ids), Comment.is_deleted == False)
        .group_by(Comment.parent_id)
    )
    return {str(row.parent_id): row.cnt for row in result.all()}


class CommentCreate(BaseModel):
    body: str = Field(..., min_length=1, max_length=500)
    media_url: str | None = Field(None, max_length=2000)

    @property
    def validated_media_url(self) -> str | None:
        return _validate_media_url(self.media_url)


class CommentUpdate(BaseModel):
    body: str = Field(..., min_length=1, max_length=500)


class CommentOut(BaseModel):
    id: str
    match_id: str
    user_id: str
    display_name: str
    body: str
    media_url: str | None
    mentions: list[str]
    is_deleted: bool
    created_at: str
    updated_at: str


@router.get("/matches/{match_id}/comments")
async def list_comments(
    match_id: str,
    db: Annotated[AsyncSession, Depends(get_db)],
    cursor: str | None = Query(None),
    limit: int = Query(30, ge=1, le=100),
    current_user_id: str | None = Query(None, alias="uid"),
):
    query = (
        select(Comment, UserProfile.display_name, UserProfile.avatar_path)
        .join(User, User.id == Comment.user_id)
        .outerjoin(UserProfile, UserProfile.user_id == Comment.user_id)
        .where(User.is_active == True, Comment.match_id == match_id, Comment.parent_id == None)
    )
    if cursor:
        query = query.where(Comment.created_at < datetime.fromisoformat(cursor))
    query = query.order_by(Comment.created_at.desc()).limit(limit + 1)
    result = await db.execute(query)
    rows = result.all()

    has_more = len(rows) > limit
    rows = rows[:limit]

    comment_ids = [c.id for c, _, _ in rows]
    reactions_map = await _get_reactions_map(db, comment_ids) if comment_ids else {}
    reply_counts = await _get_reply_counts(db, comment_ids) if comment_ids else {}
    user_reactions_map: dict = {}
    if current_user_id and comment_ids:
        try:
            user_reactions_map = await _get_user_reactions(db, comment_ids, uuid.UUID(current_user_id))
        except Exception:
            pass

    data = []
    for c, dn, avatar in rows:
        cid = c.id
        data.append({
            "id": str(c.id),
            "match_id": str(c.match_id),
            "user_id": str(c.user_id),
            "display_name": dn or "Anonymous",
            "avatar_url": avatar,
            "body": c.body if not c.is_deleted else "[deleted]",
            "media_url": c.media_url if not c.is_deleted else None,
            "is_deleted": c.is_deleted,
            "created_at": c.created_at.isoformat(),
            "updated_at": c.updated_at.isoformat(),
            "reactions": reactions_map.get(cid, {}),
            "my_reactions": user_reactions_map.get(cid, []),
            "reply_count": reply_counts.get(cid, 0),
        })

    next_cursor = data[-1]["created_at"] if data and has_more else None
    return {"data": data, "pagination": {"next_cursor": next_cursor, "has_more": has_more}}


_FeedHomeTeam = aliased(Team)
_FeedAwayTeam = aliased(Team)


@router.get("/feed")
async def global_feed(
    db: Annotated[AsyncSession, Depends(get_db)],
    cursor: str | None = Query(None),
    limit: int = Query(20, ge=1, le=50),
    current_user_id: str | None = Query(None, alias="uid"),
    author_id: str | None = Query(None),
):
    cursor_dt = datetime.fromisoformat(cursor) if cursor else None

    # ── 1. Query comments ──
    query = (
        select(
            Comment,
            UserProfile.display_name,
            UserProfile.avatar_path,
            Match,
            Stage.name,
            _FeedHomeTeam.name,
            _FeedAwayTeam.name,
        )
        .join(User, User.id == Comment.user_id)
        .outerjoin(UserProfile, UserProfile.user_id == Comment.user_id)
        .outerjoin(Match, Match.id == Comment.match_id)
        .outerjoin(Stage, Stage.id == Match.stage_id)
        .outerjoin(_FeedHomeTeam, _FeedHomeTeam.id == Match.home_team_id)
        .outerjoin(_FeedAwayTeam, _FeedAwayTeam.id == Match.away_team_id)
        .where(
            User.is_active == True,
            Comment.is_deleted == False,
            Comment.parent_id == None,
            # Exclude backing comments created for activity items
            ~select(ActivityItem.id).where(ActivityItem.comment_id == Comment.id).correlate(Comment).exists(),
        )
    )
    if author_id:
        try:
            query = query.where(Comment.user_id == uuid.UUID(author_id))
        except ValueError:
            pass
    if cursor_dt:
        query = query.where(Comment.created_at < cursor_dt)
    query = query.order_by(Comment.created_at.desc()).limit(limit + 1)
    result = await db.execute(query)
    comment_rows = result.all()

    # ── 2. Query activity items (global feed only, not author-filtered) ──
    _ActivityProfile = aliased(UserProfile)
    activity_rows: list = []
    _ActivityUser = aliased(User)
    if not author_id:
        a_query = (
            select(ActivityItem, _ActivityProfile.display_name, _ActivityProfile.avatar_path)
            .join(_ActivityUser, _ActivityUser.id == ActivityItem.actor_user_id)
            .outerjoin(_ActivityProfile, _ActivityProfile.user_id == ActivityItem.actor_user_id)
            .where(_ActivityUser.is_active == True)
        )
        if current_user_id:
            try:
                uid = uuid.UUID(current_user_id)
                follows_p1 = (
                    select(UserFollow.id)
                    .where(UserFollow.follower_id == uid,
                           UserFollow.followed_id == ActivityItem.participant1_id)
                    .correlate(ActivityItem).exists()
                )
                follows_p2 = (
                    select(UserFollow.id)
                    .where(UserFollow.follower_id == uid,
                           UserFollow.followed_id == ActivityItem.participant2_id)
                    .correlate(ActivityItem).exists()
                )
                a_query = a_query.where(
                    or_(
                        ActivityItem.visibility == "all_users",
                        ActivityItem.participant1_id == uid,
                        ActivityItem.participant2_id == uid,
                        and_(
                            ActivityItem.visibility == "participants_and_friends",
                            follows_p1,
                            follows_p2,
                        ),
                    )
                )
            except ValueError:
                a_query = a_query.where(ActivityItem.visibility == "all_users")
        else:
            a_query = a_query.where(ActivityItem.visibility == "all_users")
        if cursor_dt:
            a_query = a_query.where(ActivityItem.created_at < cursor_dt)
        a_query = a_query.order_by(ActivityItem.created_at.desc()).limit(limit + 1)
        a_result = await db.execute(a_query)
        activity_rows = a_result.all()

    # ── 3. Build merged feed ──
    comment_ids = [c.id for c, *_ in comment_rows]
    reactions_map = await _get_reactions_map(db, comment_ids)
    reply_counts = await _get_reply_counts(db, comment_ids)
    user_reactions_map: dict = {}
    if current_user_id:
        try:
            user_reactions_map = await _get_user_reactions(db, comment_ids, uuid.UUID(current_user_id))
        except ValueError:
            pass

    merged: list[tuple[datetime, dict]] = []

    for c, display_name, avatar, match, stage_name, home_name, away_name in comment_rows:
        match_data = None
        if match:
            match_data = {
                "id": str(match.id),
                "home_team": home_name,
                "away_team": away_name,
                "stage_name": stage_name,
                "status": match.status,
                "kick_off": match.kickoff_utc.isoformat(),
            }
        cid = str(c.id)
        merged.append((c.created_at, {
            "id": cid,
            "body": c.body,
            "media_url": c.media_url,
            "mentions": extract_mentions(c.body),
            "display_name": display_name or "Anonymous",
            "avatar_url": avatar,
            "user_id": str(c.user_id),
            "created_at": c.created_at.isoformat(),
            "match": match_data,
            "reactions": reactions_map.get(cid, {}),
            "my_reactions": user_reactions_map.get(cid, []),
            "reply_count": reply_counts.get(cid, 0),
            "activity_type": None,
        }))

    _CTA_MAP = {
        "flash_challenge_published": ("/challenges", "Join Challenge"),
        "duel_created": ("/duels", "View Duel"),
    }

    # Collect comment_ids from activity items for reactions/replies lookup
    activity_comment_ids = [str(a.comment_id) for a, _, _ in activity_rows if a.comment_id]
    a_reactions_map = await _get_reactions_map(db, activity_comment_ids) if activity_comment_ids else {}
    a_reply_counts = await _get_reply_counts(db, activity_comment_ids) if activity_comment_ids else {}
    a_user_reactions_map: dict = {}
    if current_user_id and activity_comment_ids:
        try:
            a_user_reactions_map = await _get_user_reactions(db, activity_comment_ids, uuid.UUID(current_user_id))
        except ValueError:
            pass

    for a, a_dn, a_av in activity_rows:
        cta_url, cta_label = _CTA_MAP.get(a.activity_type, (None, None))
        # Use comment_id as the item id so reactions/replies work via /comments/{id}/*
        item_id = str(a.comment_id) if a.comment_id else str(a.id)
        merged.append((a.created_at, {
            "id": item_id,
            "body": a.body or "",
            "media_url": None,
            "mentions": [],
            "display_name": a_dn or "REDZONE",
            "avatar_url": a_av,
            "user_id": str(a.actor_user_id) if a.actor_user_id else None,
            "created_at": a.created_at.isoformat(),
            "match": None,
            "reactions": a_reactions_map.get(item_id, {}),
            "my_reactions": a_user_reactions_map.get(item_id, []),
            "reply_count": a_reply_counts.get(item_id, 0),
            "activity_type": a.activity_type,
            "activity_title": a.title,
            "activity_cta_url": cta_url,
            "activity_cta_label": cta_label,
            "activity_metadata": a.metadata_,
        }))

    merged.sort(key=lambda x: x[0], reverse=True)
    has_more = len(merged) > limit
    merged = merged[:limit]

    data = [item[1] for item in merged]
    next_cursor = data[-1]["created_at"] if data and has_more else None
    return {"data": data, "pagination": {"next_cursor": next_cursor, "has_more": has_more}}


class FeedPostCreate(BaseModel):
    body: str = Field("", max_length=500)
    media_url: str | None = Field(None, max_length=2000)

    @model_validator(mode="after")
    def require_body_or_media(self) -> "FeedPostCreate":
        if not self.body.strip() and not self.media_url:
            raise ValueError("Post must have text or an image")
        return self

    @property
    def validated_media_url(self) -> str | None:
        return _validate_media_url(self.media_url)


@router.post("/feed", status_code=201)
async def create_feed_post(
    payload: FeedPostCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    comment = Comment(
        user_id=current_user.id,
        body=payload.body.strip(),
        media_url=payload.validated_media_url,
    )
    db.add(comment)
    await db.commit()
    await db.refresh(comment)

    profile_result = await db.execute(
        select(UserProfile.display_name, UserProfile.avatar_path).where(UserProfile.user_id == current_user.id)
    )
    profile_row = profile_result.one_or_none()
    dn = profile_row[0] if profile_row else "Anonymous"
    avatar = profile_row[1] if profile_row else None

    # Notify @mentioned users
    mentions = extract_mentions(payload.body)
    mentioned_user_ids: set[uuid.UUID] = set()
    if mentions:
        mentioned_profiles = (await db.execute(
            select(UserProfile).where(UserProfile.display_name.in_(mentions))
        )).scalars().all()
        for mp in mentioned_profiles:
            if mp.user_id != current_user.id:
                mentioned_user_ids.add(mp.user_id)
                await notify(
                    db,
                    user_id=mp.user_id,
                    type=NotifType.COMMENT_MENTION,
                    title="You were mentioned",
                    message=f"{dn} mentioned you in a post.",
                    actor_user_id=current_user.id,
                    related_entity_type="comment",
                    related_entity_id=comment.id,
                    action_url="/feed",
                    dedup_key=f"mention:{comment.id}:{mp.user_id}",
                )

    # Notify followers (skip users already notified via mention)
    follower_rows = (await db.execute(
        select(UserFollow.follower_id).where(UserFollow.followed_id == current_user.id)
    )).scalars().all()
    for fid in follower_rows:
        if fid != current_user.id and fid not in mentioned_user_ids:
            await notify(
                db,
                user_id=fid,
                type=NotifType.FOLLOWER_POST,
                title="New Post",
                message=f"{dn} shared a new post.",
                actor_user_id=current_user.id,
                related_entity_type="comment",
                related_entity_id=comment.id,
                action_url="/feed",
                dedup_key=f"follower_post:{comment.id}:{fid}",
            )

    await db.commit()

    return {
        "data": {
            "id": str(comment.id),
            "body": comment.body,
            "media_url": comment.media_url,
            "mentions": extract_mentions(comment.body),
            "display_name": dn,
            "avatar_url": avatar,
            "user_id": str(comment.user_id),
            "created_at": comment.created_at.isoformat(),
            "match": None,
            "reactions": {},
            "my_reactions": [],
            "reply_count": 0,
        }
    }


@router.post("/matches/{match_id}/comments", status_code=201)
async def create_comment(
    match_id: str,
    payload: CommentCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    comment = Comment(
        match_id=match_id,
        user_id=current_user.id,
        body=payload.body.strip(),
        media_url=payload.validated_media_url,
    )
    db.add(comment)
    await db.commit()
    await db.refresh(comment)

    profile_result = await db.execute(
        select(UserProfile.display_name, UserProfile.avatar_path).where(UserProfile.user_id == current_user.id)
    )
    profile_row = profile_result.one_or_none()
    dn = profile_row[0] if profile_row else "Anonymous"
    avatar = profile_row[1] if profile_row else None

    # Notify @mentioned users
    mentions = extract_mentions(payload.body)
    if mentions:
        mentioned_profiles = (await db.execute(
            select(UserProfile).where(UserProfile.display_name.in_(mentions))
        )).scalars().all()
        for mp in mentioned_profiles:
            if mp.user_id != current_user.id:
                await notify(
                    db,
                    user_id=mp.user_id,
                    type=NotifType.COMMENT_MENTION,
                    title="You were mentioned",
                    message=f"{dn} mentioned you in a comment.",
                    actor_user_id=current_user.id,
                    related_entity_type="comment",
                    related_entity_id=comment.id,
                    action_url=f"/matches/{match_id}/lounge",
                    dedup_key=f"mention:{comment.id}:{mp.user_id}",
                )
        await db.commit()

    return {
        "data": {
            "id": str(comment.id),
            "match_id": str(comment.match_id),
            "user_id": str(comment.user_id),
            "display_name": dn,
            "avatar_url": avatar,
            "body": comment.body,
            "media_url": comment.media_url,
            "is_deleted": False,
            "created_at": comment.created_at.isoformat(),
            "updated_at": comment.updated_at.isoformat(),
            "reactions": {},
            "my_reactions": [],
            "reply_count": 0,
        }
    }


@router.put("/comments/{comment_id}")
async def update_comment(
    comment_id: str,
    payload: CommentUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    result = await db.execute(select(Comment).where(Comment.id == comment_id))
    comment = result.scalar_one_or_none()
    if not comment or comment.is_deleted:
        raise HTTPException(status_code=404, detail="Comment not found")
    if comment.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not your comment")
    elapsed = (datetime.now(timezone.utc) - comment.created_at).total_seconds()
    if elapsed > EDIT_GRACE_SECONDS:
        raise HTTPException(status_code=403, detail="Edit window has expired (5 min)")
    comment.body = payload.body.strip()
    await db.commit()
    return {"message": "Comment updated"}


@router.delete("/comments/{comment_id}")
async def delete_comment(
    comment_id: str,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    result = await db.execute(select(Comment).where(Comment.id == comment_id))
    comment = result.scalar_one_or_none()
    if not comment or comment.is_deleted:
        raise HTTPException(status_code=404, detail="Comment not found")
    is_owner = comment.user_id == current_user.id
    is_admin = current_user.role == "admin"
    if not is_owner and not is_admin:
        raise HTTPException(status_code=403, detail="Not authorized")
    if is_owner:
        elapsed = (datetime.now(timezone.utc) - comment.created_at).total_seconds()
        if elapsed > EDIT_GRACE_SECONDS and not is_admin:
            raise HTTPException(status_code=403, detail="Delete window has expired (5 min)")
    comment.is_deleted = True
    comment.deleted_by = current_user.id
    comment.deleted_at = datetime.now(timezone.utc)
    await db.commit()
    return {"message": "Comment deleted"}


# ── Reactions ────────────────────────────────────────────────────────────────

ALLOWED_EMOJIS = {"👍", "❤️", "😂", "😮", "😢", "🔥"}


class ReactionToggle(BaseModel):
    emoji: str = Field(..., max_length=8)


@router.post("/comments/{comment_id}/reactions")
async def toggle_reaction(
    comment_id: str,
    payload: ReactionToggle,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    if payload.emoji not in ALLOWED_EMOJIS:
        raise HTTPException(status_code=400, detail=f"Emoji not allowed. Use one of: {', '.join(ALLOWED_EMOJIS)}")

    result = await db.execute(select(Comment).where(Comment.id == comment_id))
    comment = result.scalar_one_or_none()
    if not comment or comment.is_deleted:
        raise HTTPException(status_code=404, detail="Comment not found")

    existing = await db.execute(
        select(CommentReaction).where(
            CommentReaction.comment_id == comment.id,
            CommentReaction.user_id == current_user.id,
            CommentReaction.emoji == payload.emoji,
        )
    )
    reaction = existing.scalar_one_or_none()
    if reaction:
        await db.delete(reaction)
        await db.commit()
        return {"action": "removed", "emoji": payload.emoji}
    else:
        reaction = CommentReaction(
            comment_id=comment.id,
            user_id=current_user.id,
            emoji=payload.emoji,
        )
        db.add(reaction)
        await db.commit()
        return {"action": "added", "emoji": payload.emoji}


# ── Replies ──────────────────────────────────────────────────────────────────


class ReplyCreate(BaseModel):
    body: str = Field(..., min_length=1, max_length=500)


@router.get("/comments/{comment_id}/replies")
async def list_replies(
    comment_id: str,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user_id: str | None = Query(None, alias="uid"),
):
    result = await db.execute(select(Comment).where(Comment.id == comment_id))
    parent = result.scalar_one_or_none()
    if not parent:
        raise HTTPException(status_code=404, detail="Comment not found")

    query = (
        select(Comment, UserProfile.display_name, UserProfile.avatar_path)
        .join(User, User.id == Comment.user_id)
        .outerjoin(UserProfile, UserProfile.user_id == Comment.user_id)
        .where(User.is_active == True, Comment.parent_id == parent.id, Comment.is_deleted == False)
        .order_by(Comment.created_at.asc())
        .limit(100)
    )
    rows = (await db.execute(query)).all()

    reply_ids = [c.id for c, _, _ in rows]
    reactions_map = await _get_reactions_map(db, reply_ids)
    user_reactions_map: dict = {}
    if current_user_id:
        try:
            user_reactions_map = await _get_user_reactions(db, reply_ids, uuid.UUID(current_user_id))
        except ValueError:
            pass

    data = []
    for c, dn, avatar in rows:
        cid = str(c.id)
        data.append({
            "id": cid,
            "body": c.body,
            "display_name": dn or "Anonymous",
            "avatar_url": avatar,
            "user_id": str(c.user_id),
            "created_at": c.created_at.isoformat(),
            "reactions": reactions_map.get(cid, {}),
            "my_reactions": user_reactions_map.get(cid, []),
        })
    return {"data": data}


@router.post("/comments/{comment_id}/replies", status_code=201)
async def create_reply(
    comment_id: str,
    payload: ReplyCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    result = await db.execute(select(Comment).where(Comment.id == comment_id))
    parent = result.scalar_one_or_none()
    if not parent or parent.is_deleted:
        raise HTTPException(status_code=404, detail="Comment not found")

    reply = Comment(
        match_id=parent.match_id,
        user_id=current_user.id,
        parent_id=parent.id,
        body=payload.body.strip(),
    )
    db.add(reply)
    await db.commit()
    await db.refresh(reply)

    profile_result = await db.execute(
        select(UserProfile.display_name, UserProfile.avatar_path).where(UserProfile.user_id == current_user.id)
    )
    profile_row = profile_result.one_or_none()
    dn = profile_row[0] if profile_row else "Anonymous"
    avatar = profile_row[1] if profile_row else None

    # Notify parent comment author (if different from replier)
    if parent.user_id != current_user.id:
        await notify(
            db,
            user_id=parent.user_id,
            type=NotifType.COMMENT_REPLY,
            title="New Reply",
            message=f"{dn} replied to your comment.",
            actor_user_id=current_user.id,
            related_entity_type="comment",
            related_entity_id=reply.id,
            action_url=f"/matches/{parent.match_id}/lounge" if parent.match_id else "/feed",
            dedup_key=f"reply:{parent.id}:{current_user.id}",
        )

    # Notify @mentioned users
    mentions = extract_mentions(payload.body)
    if mentions:
        mentioned_profiles = (await db.execute(
            select(UserProfile).where(UserProfile.display_name.in_(mentions))
        )).scalars().all()
        for mp in mentioned_profiles:
            if mp.user_id != current_user.id and mp.user_id != parent.user_id:
                await notify(
                    db,
                    user_id=mp.user_id,
                    type=NotifType.COMMENT_MENTION,
                    title="You were mentioned",
                    message=f"{dn} mentioned you in a comment.",
                    actor_user_id=current_user.id,
                    related_entity_type="comment",
                    related_entity_id=reply.id,
                    action_url=f"/matches/{parent.match_id}/lounge" if parent.match_id else "/feed",
                    dedup_key=f"mention:{reply.id}:{mp.user_id}",
                )
        await db.commit()

    return {
        "data": {
            "id": str(reply.id),
            "body": reply.body,
            "display_name": dn,
            "avatar_url": avatar,
            "user_id": str(reply.user_id),
            "created_at": reply.created_at.isoformat(),
            "reactions": {},
            "my_reactions": [],
        }
    }
