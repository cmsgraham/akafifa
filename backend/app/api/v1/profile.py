import json as _json
import os
import time as _time
import uuid as _uuid
from pathlib import Path
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File
from pydantic import BaseModel, Field
from sqlalchemy import func, select, delete
from sqlalchemy.ext.asyncio import AsyncSession
from PIL import Image
import io

from app.core.config import settings
from app.core.dependencies import get_current_user
from app.db.models import User, UserProfile, UserFollow, DuelChallenge, Prediction
from app.db.session import get_db
from app.services.notifications import notify, NotifType
from app.services.storage import upload_profile_image, delete_s3_object

router = APIRouter(prefix="/api", tags=["profile"])

ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp"}
MAX_AVATAR_SIZE = 5 * 1024 * 1024  # 5 MB
AVATAR_DIMENSION = 512
MAX_COVER_SIZE = 10 * 1024 * 1024  # 10 MB
COVER_MAX_DIM = 1600  # max width or height, keep aspect ratio


class ProfileOut(BaseModel):
    display_name: str
    avatar_url: str | None = None
    cover_url: str | None = None
    avatar_crop: str | None = None
    cover_crop: str | None = None
    bio: str | None = None
    timezone: str = "America/Costa_Rica"
    favorite_team_id: str | None = None
    total_points: int = 0
    exact_hits: int = 0
    outcome_hits: int = 0


class ProfileUpdate(BaseModel):
    display_name: str | None = Field(None, min_length=1, max_length=50)
    bio: str | None = Field(None, max_length=500)
    timezone: str | None = Field(None, max_length=50)


@router.get("/me/profile")
async def get_profile(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(UserProfile).where(UserProfile.user_id == current_user.id)
    )
    profile = result.scalar_one_or_none()
    if not profile:
        return ProfileOut(display_name=current_user.email.split("@")[0])
    return ProfileOut(
        display_name=profile.display_name,
        avatar_url=profile.avatar_path,
        cover_url=profile.cover_path,
        avatar_crop=profile.avatar_crop,
        cover_crop=profile.cover_crop,
        bio=profile.bio,
        timezone=profile.timezone if hasattr(profile, "timezone") and profile.timezone else "America/Costa_Rica",
        favorite_team_id=str(profile.favorite_team_id) if profile.favorite_team_id else None,
        total_points=profile.total_points,
        exact_hits=profile.exact_hits,
        outcome_hits=profile.outcome_hits,
    )


@router.put("/me/profile")
async def update_profile(
    body: ProfileUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(UserProfile).where(UserProfile.user_id == current_user.id)
    )
    profile = result.scalar_one_or_none()
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")

    if body.display_name is not None:
        profile.display_name = body.display_name
    if body.bio is not None:
        profile.bio = body.bio
    if body.timezone is not None:
        profile.timezone = body.timezone

    await db.commit()
    return {"message": "Profile updated"}


@router.post("/me/avatar")
async def upload_avatar(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if file.content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(status_code=400, detail="Only JPEG, PNG, or WebP images are allowed")

    raw = await file.read()
    if len(raw) > MAX_AVATAR_SIZE:
        raise HTTPException(status_code=400, detail="File too large (max 5 MB)")

    try:
        img = Image.open(io.BytesIO(raw))
        img.verify()
        img = Image.open(io.BytesIO(raw))
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid image file")

    # Resize keeping aspect ratio (larger than before for crop flexibility)
    img = img.convert("RGB")
    img.thumbnail((AVATAR_DIMENSION, AVATAR_DIMENSION), Image.LANCZOS)

    buf = io.BytesIO()
    img.save(buf, "JPEG", quality=85)
    buf.seek(0)

    s3_key = f"avatars/{current_user.id}.jpg"
    base_url = upload_profile_image(buf.read(), s3_key)
    avatar_url = f"{base_url}?v={int(_time.time())}"

    result = await db.execute(
        select(UserProfile).where(UserProfile.user_id == current_user.id)
    )
    profile = result.scalar_one_or_none()
    if profile:
        profile.avatar_path = avatar_url
        profile.avatar_crop = None  # reset crop on new upload
        await db.commit()

    return {"avatar_url": avatar_url}


@router.post("/me/cover")
async def upload_cover(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if file.content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(status_code=400, detail="Only JPEG, PNG, or WebP images are allowed")

    raw = await file.read()
    if len(raw) > MAX_COVER_SIZE:
        raise HTTPException(status_code=400, detail="File too large (max 10 MB)")

    try:
        img = Image.open(io.BytesIO(raw))
        img.verify()
        img = Image.open(io.BytesIO(raw))
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid image file")

    img = img.convert("RGB")
    # Resize keeping aspect ratio (no forced crop; frontend handles positioning)
    img.thumbnail((COVER_MAX_DIM, COVER_MAX_DIM), Image.LANCZOS)

    buf = io.BytesIO()
    img.save(buf, "JPEG", quality=85)
    buf.seek(0)

    s3_key = f"covers/{current_user.id}.jpg"
    base_url = upload_profile_image(buf.read(), s3_key)
    cover_url = f"{base_url}?v={int(_time.time())}"

    result = await db.execute(
        select(UserProfile).where(UserProfile.user_id == current_user.id)
    )
    profile = result.scalar_one_or_none()
    if profile:
        profile.cover_path = cover_url
        profile.cover_crop = None  # reset crop on new upload
        await db.commit()

    return {"cover_url": cover_url}


@router.delete("/me/cover")
async def delete_cover(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(UserProfile).where(UserProfile.user_id == current_user.id)
    )
    profile = result.scalar_one_or_none()
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")

    if profile.cover_path:
        s3_key = f"covers/{current_user.id}.jpg"
        delete_s3_object(s3_key)
        profile.cover_path = None
        await db.commit()

    return {"message": "Cover photo removed"}


class ImageCropUpdate(BaseModel):
    target: Literal["avatar", "cover"]
    scale: float = Field(ge=1.0, le=5.0)
    x: float = Field(ge=-100, le=100)
    y: float = Field(ge=-100, le=100)


@router.put("/me/image-crop")
async def update_image_crop(
    body: ImageCropUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(UserProfile).where(UserProfile.user_id == current_user.id)
    )
    profile = result.scalar_one_or_none()
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")

    crop_json = _json.dumps({"scale": body.scale, "x": body.x, "y": body.y})
    if body.target == "avatar":
        profile.avatar_crop = crop_json
    else:
        profile.cover_crop = crop_json

    await db.commit()
    return {"message": "Crop updated"}


@router.get("/users/search")
async def search_users(
    q: str = Query(..., min_length=1, max_length=50),
    limit: int = Query(10, ge=1, le=20),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Search users by display_name prefix for @mention autocomplete."""
    result = await db.execute(
        select(UserProfile.user_id, UserProfile.display_name, UserProfile.avatar_path)
        .where(func.lower(UserProfile.display_name).like(func.lower(q) + "%"))
        .order_by(UserProfile.display_name)
        .limit(limit)
    )
    rows = result.all()
    return {
        "data": [
            {"id": str(uid), "display_name": dn, "avatar_url": avatar}
            for uid, dn, avatar in rows
        ]
    }


# ── Public profile ───────────────────────────────────────────────────────────


@router.get("/users/{user_id}/profile")
async def get_public_profile(
    user_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get a user's public profile with stats and follow status."""
    try:
        uid = _uuid.UUID(user_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid user ID")

    profile = (await db.execute(
        select(UserProfile).where(UserProfile.user_id == uid)
    )).scalar_one_or_none()
    if not profile:
        raise HTTPException(status_code=404, detail="User not found")

    # Follow counts
    followers_count = (await db.execute(
        select(func.count()).select_from(UserFollow).where(UserFollow.followed_id == uid)
    )).scalar_one()
    following_count = (await db.execute(
        select(func.count()).select_from(UserFollow).where(UserFollow.follower_id == uid)
    )).scalar_one()

    # Am I following this user?
    is_following = False
    if current_user.id != uid:
        existing = (await db.execute(
            select(UserFollow.id).where(
                UserFollow.follower_id == current_user.id,
                UserFollow.followed_id == uid,
            )
        )).scalar_one_or_none()
        is_following = existing is not None

    # Prediction stats
    pred_count = (await db.execute(
        select(func.count()).select_from(Prediction).where(Prediction.user_id == uid)
    )).scalar_one()

    # Duel record
    duel_total = profile.duel_wins + profile.duel_losses + profile.duel_draws

    return {
        "id": str(uid),
        "display_name": profile.display_name,
        "avatar_url": profile.avatar_path,
        "cover_url": profile.cover_path,
        "avatar_crop": profile.avatar_crop,
        "cover_crop": profile.cover_crop,
        "bio": profile.bio,
        "total_points": profile.total_points,
        "exact_hits": profile.exact_hits,
        "outcome_hits": profile.outcome_hits,
        "predictions_count": pred_count,
        "duel_wins": profile.duel_wins,
        "duel_losses": profile.duel_losses,
        "duel_draws": profile.duel_draws,
        "duel_total": duel_total,
        "followers_count": followers_count,
        "following_count": following_count,
        "is_following": is_following,
        "is_own_profile": current_user.id == uid,
    }


# ── Follow / Unfollow ───────────────────────────────────────────────────────


@router.post("/users/{user_id}/follow")
async def follow_user(
    user_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        uid = _uuid.UUID(user_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid user ID")

    if current_user.id == uid:
        raise HTTPException(status_code=400, detail="Cannot follow yourself")

    # Check target exists
    target = (await db.execute(
        select(UserProfile).where(UserProfile.user_id == uid)
    )).scalar_one_or_none()
    if not target:
        raise HTTPException(status_code=404, detail="User not found")

    # Check not already following
    existing = (await db.execute(
        select(UserFollow.id).where(
            UserFollow.follower_id == current_user.id,
            UserFollow.followed_id == uid,
        )
    )).scalar_one_or_none()
    if existing:
        raise HTTPException(status_code=409, detail="Already following")

    follow = UserFollow(follower_id=current_user.id, followed_id=uid)
    db.add(follow)

    # Get follower display name for notification
    my_profile = (await db.execute(
        select(UserProfile.display_name).where(UserProfile.user_id == current_user.id)
    )).scalar_one_or_none()
    my_name = my_profile or "Someone"

    await notify(
        db,
        user_id=uid,
        type=NotifType.NEW_FOLLOWER,
        title="New Follower",
        message=f"{my_name} started following you.",
        actor_user_id=current_user.id,
        related_entity_type="user",
        related_entity_id=current_user.id,
        action_url=f"/users/{current_user.id}",
        dedup_key=f"follow:{current_user.id}:{uid}",
    )

    await db.commit()
    return {"message": "Followed", "is_following": True}


@router.delete("/users/{user_id}/follow")
async def unfollow_user(
    user_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        uid = _uuid.UUID(user_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid user ID")

    result = await db.execute(
        delete(UserFollow).where(
            UserFollow.follower_id == current_user.id,
            UserFollow.followed_id == uid,
        )
    )
    if result.rowcount == 0:
        raise HTTPException(status_code=404, detail="Not following")

    await db.commit()
    return {"message": "Unfollowed", "is_following": False}


@router.get("/me/following")
async def my_following(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List users I follow."""
    rows = (await db.execute(
        select(UserFollow.followed_id, UserProfile.display_name, UserProfile.avatar_path)
        .join(UserProfile, UserProfile.user_id == UserFollow.followed_id)
        .where(UserFollow.follower_id == current_user.id)
        .order_by(UserProfile.display_name)
    )).all()
    return {
        "data": [
            {"id": str(uid), "display_name": dn, "avatar_url": avatar}
            for uid, dn, avatar in rows
        ]
    }


@router.get("/me/followers")
async def my_followers(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List users who follow me."""
    rows = (await db.execute(
        select(UserFollow.follower_id, UserProfile.display_name, UserProfile.avatar_path)
        .join(UserProfile, UserProfile.user_id == UserFollow.follower_id)
        .where(UserFollow.followed_id == current_user.id)
        .order_by(UserProfile.display_name)
    )).all()
    return {
        "data": [
            {"id": str(uid), "display_name": dn, "avatar_url": avatar}
            for uid, dn, avatar in rows
        ]
    }
