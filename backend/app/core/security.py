from datetime import datetime, timedelta, timezone

import jwt
from argon2 import PasswordHasher

from app.core.config import settings

ph = PasswordHasher()


def hash_password(password: str) -> str:
    return ph.hash(password)


def verify_password(password: str, hashed: str) -> bool:
    try:
        return ph.verify(hashed, password)
    except Exception:
        return False


def create_access_token(user_id: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(
        minutes=settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES
    )
    payload = {"sub": user_id, "exp": expire, "type": "access"}
    return jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm="HS256")


def create_refresh_token(user_id: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(
        days=settings.JWT_REFRESH_TOKEN_EXPIRE_DAYS
    )
    payload = {"sub": user_id, "exp": expire, "type": "refresh"}
    return jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm="HS256")


def decode_token(token: str) -> dict:
    return jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=["HS256"])
