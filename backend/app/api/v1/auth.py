from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Response, status
from pydantic import BaseModel, EmailStr
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.dependencies import get_current_user
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    verify_password,
)
from app.db.models import User, UserProfile
from app.db.session import get_db

router = APIRouter(prefix="/api/auth", tags=["auth"])


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    display_name: str


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


@router.post("/register", status_code=status.HTTP_201_CREATED)
async def register(
    body: RegisterRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    response: Response,
):
    # Validate email domain
    allowed = settings.ALLOWED_EMAIL_DOMAINS
    if allowed:
        domains = [d.strip().lower() for d in allowed.split(",") if d.strip()]
        email_domain = body.email.split("@")[1].lower()
        if email_domain not in domains:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Registration not allowed for domain '{email_domain}'",
            )

    # Check uniqueness
    existing = await db.execute(select(User).where(User.email == body.email))
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email already registered",
        )

    user = User(
        email=body.email,
        password_hash=hash_password(body.password),
    )
    db.add(user)
    await db.flush()

    profile = UserProfile(user_id=user.id, display_name=body.display_name)
    db.add(profile)

    # Set auth cookies
    access = create_access_token(str(user.id))
    refresh = create_refresh_token(str(user.id))
    response.set_cookie(
        "access_token", access,
        httponly=True, samesite="strict", secure=settings.APP_ENV != "local",
        max_age=settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )
    response.set_cookie(
        "refresh_token", refresh,
        httponly=True, samesite="strict", secure=settings.APP_ENV != "local",
        max_age=settings.JWT_REFRESH_TOKEN_EXPIRE_DAYS * 86400,
        path="/api/auth/refresh",
    )
    return {"message": "Registered successfully", "user_id": str(user.id)}


@router.post("/login")
async def login(
    body: LoginRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    response: Response,
):
    result = await db.execute(select(User).where(User.email == body.email))
    user = result.scalar_one_or_none()
    if not user or not verify_password(body.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is deactivated",
        )

    access = create_access_token(str(user.id))
    refresh = create_refresh_token(str(user.id))
    response.set_cookie(
        "access_token", access,
        httponly=True, samesite="strict", secure=settings.APP_ENV != "local",
        max_age=settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )
    response.set_cookie(
        "refresh_token", refresh,
        httponly=True, samesite="strict", secure=settings.APP_ENV != "local",
        max_age=settings.JWT_REFRESH_TOKEN_EXPIRE_DAYS * 86400,
        path="/api/auth/refresh",
    )
    return {"message": "Logged in", "user_id": str(user.id)}


@router.post("/logout")
async def logout(response: Response):
    response.delete_cookie("access_token")
    response.delete_cookie("refresh_token", path="/api/auth/refresh")
    return {"message": "Logged out"}


@router.post("/refresh")
async def refresh_token(
    response: Response,
    db: Annotated[AsyncSession, Depends(get_db)],
    refresh_token: str | None = None,
):
    from fastapi import Cookie as CookieParam

    # refresh_token comes from the cookie
    if not refresh_token:
        raise HTTPException(status_code=401, detail="No refresh token")
    try:
        payload = decode_token(refresh_token)
        if payload.get("type") != "refresh":
            raise HTTPException(status_code=401, detail="Invalid token type")
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid or expired refresh token")

    user_id = payload["sub"]
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="User not found or inactive")

    # Rotate tokens
    new_access = create_access_token(str(user.id))
    new_refresh = create_refresh_token(str(user.id))
    response.set_cookie(
        "access_token", new_access,
        httponly=True, samesite="strict", secure=settings.APP_ENV != "local",
        max_age=settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )
    response.set_cookie(
        "refresh_token", new_refresh,
        httponly=True, samesite="strict", secure=settings.APP_ENV != "local",
        max_age=settings.JWT_REFRESH_TOKEN_EXPIRE_DAYS * 86400,
        path="/api/auth/refresh",
    )
    return {"message": "Token refreshed"}


@router.get("/me")
async def me(current_user: Annotated[User, Depends(get_current_user)]):
    return {
        "id": str(current_user.id),
        "email": current_user.email,
        "role": current_user.role,
        "is_active": current_user.is_active,
    }
