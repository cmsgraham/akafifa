from typing import Annotated
import json
import secrets

from fastapi import APIRouter, Cookie, Depends, HTTPException, Response, status
from pydantic import BaseModel, EmailStr
from redis import Redis
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
from app.db.models import OutboundEmailJob, User, UserProfile
from app.db.session import get_db
from app.services.email.sender import load_template

router = APIRouter(prefix="/api/auth", tags=["auth"])

VERIFY_CODE_TTL = 600  # 10 minutes
VERIFY_CODE_PREFIX = "reg_verify:"

# Refresh-token cookie is scoped to the refresh endpoint so it is not sent
# with every API request. Keep this in sync with the path used in
# set_cookie / delete_cookie below.
REFRESH_COOKIE_PATH = "/api/auth/refresh"


def _set_auth_cookies(response: Response, access: str, refresh: str) -> None:
    """Set the access + refresh cookies with the project-wide attributes.

    SameSite=lax keeps cookies on top-level GET navigations so users don't get
    spuriously logged out when following links back to the app, while still
    blocking most cross-site CSRF vectors.
    """
    secure = settings.APP_ENV != "local"
    response.set_cookie(
        "access_token",
        access,
        httponly=True,
        samesite="lax",
        secure=secure,
        max_age=settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        path="/",
    )
    response.set_cookie(
        "refresh_token",
        refresh,
        httponly=True,
        samesite="lax",
        secure=secure,
        max_age=settings.JWT_REFRESH_TOKEN_EXPIRE_DAYS * 86400,
        path=REFRESH_COOKIE_PATH,
    )


def _clear_auth_cookies(response: Response) -> None:
    response.delete_cookie("access_token", path="/")
    response.delete_cookie("refresh_token", path=REFRESH_COOKIE_PATH)


def _get_redis() -> Redis:
    return Redis.from_url(settings.REDIS_URL, decode_responses=True)


ALLOWED_COUNTRIES = {"Mexico", "Costa Rica", "Brazil", "Colombia", "Argentina", "USA"}


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    display_name: str
    country: str


class VerifyCodeRequest(BaseModel):
    email: EmailStr
    code: str


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


@router.post("/register/send-code")
async def register_send_code(
    body: RegisterRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Step 1: Validate input, generate 6-digit code, store in Redis, send email."""
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

    # Validate country
    if body.country not in ALLOWED_COUNTRIES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid country selection",
        )

    # Check uniqueness
    existing = await db.execute(select(User).where(User.email == body.email))
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email already registered",
        )

    # Generate 6-digit code
    code = f"{secrets.randbelow(1000000):06d}"

    # Store registration data + code in Redis
    r = _get_redis()
    key = f"{VERIFY_CODE_PREFIX}{body.email.lower()}"
    r.setex(key, VERIFY_CODE_TTL, json.dumps({
        "code": code,
        "email": body.email,
        "password_hash": hash_password(body.password),
        "display_name": body.display_name,
        "country": body.country,
    }))

    # Send verification email
    email_body = load_template(
        "verification_code.txt",
        display_name=body.display_name,
        code=code,
    )
    db.add(OutboundEmailJob(
        to_address=body.email,
        subject=f"Your REDZONE verification code: {code}",
        body=email_body,
    ))

    return {"message": "Verification code sent to your email"}


@router.post("/register/verify", status_code=status.HTTP_201_CREATED)
async def register_verify(
    body: VerifyCodeRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    response: Response,
):
    """Step 2: Verify code and create the account."""
    r = _get_redis()
    key = f"{VERIFY_CODE_PREFIX}{body.email.lower()}"
    raw = r.get(key)
    if not raw:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Verification code expired or not found. Please request a new one.",
        )

    data = json.loads(raw)
    if not secrets.compare_digest(data["code"], body.code.strip()):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid verification code",
        )

    # Re-check uniqueness (race condition guard)
    existing = await db.execute(select(User).where(User.email == body.email))
    if existing.scalar_one_or_none():
        r.delete(key)
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email already registered",
        )

    # Create user
    user = User(
        email=data["email"],
        password_hash=data["password_hash"],
    )
    db.add(user)
    await db.flush()

    profile = UserProfile(
        user_id=user.id,
        display_name=data["display_name"],
        country=data.get("country"),
        total_points=10,
    )
    db.add(profile)

    # Enqueue welcome email
    welcome_body = load_template("welcome.txt", display_name=data["display_name"])
    db.add(OutboundEmailJob(
        to_address=data["email"],
        subject="Welcome to REDZONE!",
        body=welcome_body,
    ))

    # Clean up Redis
    r.delete(key)

    # Set auth cookies
    access = create_access_token(str(user.id))
    refresh = create_refresh_token(str(user.id))
    _set_auth_cookies(response, access, refresh)
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
    _set_auth_cookies(response, access, refresh)
    return {"message": "Logged in", "user_id": str(user.id)}


@router.post("/logout")
async def logout(response: Response):
    _clear_auth_cookies(response)
    return {"message": "Logged out"}


@router.post("/refresh")
async def refresh_token(
    response: Response,
    db: Annotated[AsyncSession, Depends(get_db)],
    refresh_token: Annotated[str | None, Cookie()] = None,
):
    """Rotate the access + refresh cookies using the refresh cookie.

    The refresh cookie is read from the ``refresh_token`` HTTP-only cookie,
    which is scoped to this endpoint's path. Each successful refresh slides
    the session window forward, so a user who hits the API at least once
    every ``JWT_REFRESH_TOKEN_EXPIRE_DAYS`` stays logged in indefinitely.
    """
    if not refresh_token:
        raise HTTPException(status_code=401, detail="No refresh token")
    try:
        payload = decode_token(refresh_token)
        if payload.get("type") != "refresh":
            raise HTTPException(status_code=401, detail="Invalid token type")
    except HTTPException:
        raise
    except Exception:
        _clear_auth_cookies(response)
        raise HTTPException(status_code=401, detail="Invalid or expired refresh token")

    user_id = payload["sub"]
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user or not user.is_active:
        _clear_auth_cookies(response)
        raise HTTPException(status_code=401, detail="User not found or inactive")

    # Rotate tokens (sliding session window)
    new_access = create_access_token(str(user.id))
    new_refresh = create_refresh_token(str(user.id))
    _set_auth_cookies(response, new_access, new_refresh)
    return {"message": "Token refreshed"}


@router.get("/me")
async def me(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    profile = (await db.execute(
        select(UserProfile).where(UserProfile.user_id == current_user.id)
    )).scalar_one_or_none()
    return {
        "id": str(current_user.id),
        "email": current_user.email,
        "role": current_user.role,
        "is_active": current_user.is_active,
        "display_name": profile.display_name if profile else current_user.email.split("@")[0],
    }


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str


@router.post("/forgot-password")
async def forgot_password(
    body: ForgotPasswordRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Send a password reset link to the user's email."""
    import secrets
    from datetime import datetime, timedelta, timezone

    result = await db.execute(select(User).where(User.email == body.email))
    user = result.scalar_one_or_none()

    # Always return 200 to prevent email enumeration
    if not user:
        return {"message": "If an account exists, a reset link has been sent."}

    # Create a signed reset token (1-hour expiry)
    import jwt as pyjwt
    payload = {
        "sub": str(user.id),
        "type": "password_reset",
        "exp": datetime.now(timezone.utc) + timedelta(hours=1),
        "jti": secrets.token_hex(16),
    }
    token = pyjwt.encode(payload, settings.APP_SECRET_KEY, algorithm="HS256")

    # Enqueue email job
    profile = (await db.execute(
        select(UserProfile).where(UserProfile.user_id == user.id)
    )).scalar_one_or_none()
    display = profile.display_name if profile else user.email.split("@")[0]
    reset_link = f"https://redzone-soccer.com/reset-password?token={token}"
    reset_body = load_template(
        "password_reset.txt",
        display_name=display,
        reset_link=reset_link,
    )
    email_job = OutboundEmailJob(
        to_address=user.email,
        subject="Password Reset — REDZONE",
        body=reset_body,
    )
    db.add(email_job)

    return {"message": "If an account exists, a reset link has been sent."}


@router.post("/reset-password")
async def reset_password(
    body: ResetPasswordRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Reset a user's password using a valid reset token."""
    import jwt as pyjwt

    try:
        payload = pyjwt.decode(
            body.token, settings.APP_SECRET_KEY, algorithms=["HS256"]
        )
        if payload.get("type") != "password_reset":
            raise HTTPException(status_code=400, detail="Invalid token type")
    except pyjwt.ExpiredSignatureError:
        raise HTTPException(status_code=400, detail="Reset token has expired")
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid reset token")

    user_id = payload["sub"]
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=400, detail="Invalid reset token")

    user.password_hash = hash_password(body.new_password)
    return {"message": "Password has been reset successfully"}
