from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import require_admin
from app.db.models import AuditLog, User, UserProfile
from app.db.session import get_db

router = APIRouter(prefix="/api/admin/users", tags=["admin-users"])


class RoleUpdate(BaseModel):
    role: str  # "user" or "admin"


class UserOut(BaseModel):
    id: str
    email: str
    role: str
    is_active: bool
    display_name: str
    total_points: int
    prediction_points: int
    challenge_points: int
    duel_points: int
    created_at: str


@router.get("")
async def list_users(
    db: Annotated[AsyncSession, Depends(get_db)],
    admin: Annotated[User, Depends(require_admin)],
    q: str | None = Query(None),
    role: str | None = Query(None),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
):
    """List all users with optional search/filter."""
    query = (
        select(User, UserProfile)
        .outerjoin(UserProfile, UserProfile.user_id == User.id)
        .order_by(User.created_at.desc())
    )
    if q:
        pattern = f"%{q}%"
        query = query.where(
            (func.lower(User.email).like(func.lower(pattern)))
            | (func.lower(UserProfile.display_name).like(func.lower(pattern)))
        )
    if role and role in ("user", "admin"):
        query = query.where(User.role == role)

    # Count total
    count_q = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_q)).scalar() or 0

    query = query.offset(offset).limit(limit)
    result = await db.execute(query)
    rows = result.all()

    data = [
        UserOut(
            id=str(u.id),
            email=u.email,
            role=u.role,
            is_active=u.is_active,
            display_name=p.display_name if p else "—",
            prediction_points=p.total_points if p else 0,
            challenge_points=p.challenge_points_balance if p else 0,
            duel_points=p.duel_points_balance if p else 0,
            total_points=(p.total_points + (p.challenge_points_balance or 0) + (p.duel_points_balance or 0)) if p else 0,
            created_at=u.created_at.isoformat(),
        )
        for u, p in rows
    ]
    return {"data": data, "total": total}


@router.get("/{user_id}")
async def get_user(
    user_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    admin: Annotated[User, Depends(require_admin)],
):
    result = await db.execute(
        select(User, UserProfile)
        .outerjoin(UserProfile, UserProfile.user_id == User.id)
        .where(User.id == user_id)
    )
    row = result.one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="User not found")
    u, p = row
    return {
        "id": str(u.id),
        "email": u.email,
        "role": u.role,
        "is_active": u.is_active,
        "display_name": p.display_name if p else "—",
        "prediction_points": p.total_points if p else 0,
        "challenge_points": p.challenge_points_balance if p else 0,
        "duel_points": p.duel_points_balance if p else 0,
        "total_points": (p.total_points + (p.challenge_points_balance or 0) + (p.duel_points_balance or 0)) if p else 0,
        "exact_hits": p.exact_hits if p else 0,
        "outcome_hits": p.outcome_hits if p else 0,
        "created_at": u.created_at.isoformat(),
    }


@router.put("/{user_id}/role")
async def update_role(
    user_id: UUID,
    body: RoleUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    admin: Annotated[User, Depends(require_admin)],
):
    if body.role not in ("user", "admin"):
        raise HTTPException(status_code=400, detail="Role must be 'user' or 'admin'")
    if user_id == admin.id:
        raise HTTPException(status_code=400, detail="Cannot change your own role")

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    old_role = user.role
    user.role = body.role

    audit = AuditLog(
        actor_id=admin.id,
        action="change_role",
        resource_type="user",
        resource_id=user.id,
        before_state={"role": old_role},
        after_state={"role": body.role},
    )
    db.add(audit)
    await db.commit()

    return {"message": f"Role updated to {body.role}"}


class ActiveUpdate(BaseModel):
    is_active: bool


@router.put("/{user_id}/toggle-active")
async def toggle_active(
    user_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    admin: Annotated[User, Depends(require_admin)],
    body: ActiveUpdate | None = None,
):
    if user_id == admin.id:
        raise HTTPException(status_code=400, detail="Cannot deactivate yourself")

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    old_active = user.is_active
    user.is_active = (not user.is_active) if body is None else body.is_active

    audit = AuditLog(
        actor_id=admin.id,
        action="toggle_active",
        resource_type="user",
        resource_id=user.id,
        before_state={"is_active": old_active},
        after_state={"is_active": user.is_active},
    )
    db.add(audit)
    await db.commit()

    status_text = "activated" if user.is_active else "deactivated"
    return {"message": f"User {status_text}", "is_active": user.is_active}
