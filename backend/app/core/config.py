from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # App
    APP_ENV: str = "local"
    APP_SECRET_KEY: str = "change-me-in-production"
    CORS_ORIGINS: str = "http://localhost:3000"

    # Database
    DATABASE_URL: str = "postgresql+asyncpg://tournament:tournament@db:5432/tournament_hub"

    # Redis
    REDIS_URL: str = "redis://redis:6379/0"

    # JWT
    JWT_SECRET_KEY: str = "change-me-in-production"
    JWT_ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    JWT_REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # Auth
    ALLOWED_EMAIL_DOMAINS: str = ""  # comma-separated; empty = allow all

    # SMTP
    SMTP_HOST: str = "mailpit"
    SMTP_PORT: int = 1025
    SMTP_USERNAME: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_FROM_ADDRESS: str = "noreply@company.com"
    SMTP_TLS_ENABLED: bool = False

    # External soccer API
    SOCCER_API_KEY: str = ""
    SOCCER_API_PROVIDER: str = "football-data"

    # Feature config
    DUEL_INVITE_EXPIRY_HOURS: int = 24
    COMMENT_GRACE_PERIOD_MINUTES: int = 5
    DEFAULT_LOCKOUT_HOURS: float = 1.0

    # Avatar storage
    AVATAR_STORAGE: str = "local"  # or "s3"
    AVATAR_LOCAL_PATH: str = "/app/avatars"
    S3_BUCKET: str = ""
    S3_REGION: str = ""
    AWS_ACCESS_KEY_ID: str = ""
    AWS_SECRET_ACCESS_KEY: str = ""

    model_config = {"env_file": ".env", "extra": "ignore"}


settings = Settings()
