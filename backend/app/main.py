import logging
from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.core.config import settings

logger = logging.getLogger("uvicorn.error")
from app.api.v1 import auth, matches, predictions, leaderboards, comments, duels, challenges, profile, notifications, uploads, news, scores, tickets, games
from app.api.v1.admin import (
    matches as admin_matches,
    challenges as admin_challenges,
    users as admin_users,
    stages as admin_stages,
    settings as admin_settings,
    audit_logs as admin_audit_logs,
    comments as admin_comments,
    prizes as admin_prizes,
    reports as admin_reports,
    tickets as admin_tickets,
)

app = FastAPI(
    title="The Tournament Hub",
    version="0.1.0",
    docs_url="/api/docs" if settings.APP_ENV == "local" else None,
    redoc_url="/api/redoc" if settings.APP_ENV == "local" else None,
    openapi_url="/api/openapi.json" if settings.APP_ENV == "local" else None,
)

# CORS
origins = [o.strip() for o in settings.CORS_ORIGINS.split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Public routers ───────────────────────────────────────────────────────────
app.include_router(auth.router)
app.include_router(matches.router)
app.include_router(predictions.router)
app.include_router(leaderboards.router)
app.include_router(comments.router)
app.include_router(duels.router)
app.include_router(challenges.router)
app.include_router(profile.router)
app.include_router(notifications.router)
app.include_router(uploads.router)
app.include_router(news.router)
app.include_router(scores.router)
app.include_router(tickets.router)
app.include_router(games.router)

# ── Admin routers ────────────────────────────────────────────────────────────
app.include_router(admin_matches.router)
app.include_router(admin_challenges.router)
app.include_router(admin_users.router)
app.include_router(admin_stages.router)
app.include_router(admin_settings.router)
app.include_router(admin_audit_logs.router)
app.include_router(admin_comments.router)
app.include_router(admin_prizes.router)
app.include_router(admin_reports.router)
app.include_router(admin_tickets.router)


# ── Validation error logging ─────────────────────────────────────────────────
@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    body = await request.body()
    logger.error("422 Validation Error on %s %s | body=%s | errors=%s",
                 request.method, request.url.path, body.decode("utf-8", errors="replace")[:500], exc.errors())
    return JSONResponse(status_code=422, content={"detail": exc.errors()})


# ── Health endpoints ─────────────────────────────────────────────────────────
@app.get("/api/health")
async def health():
    from sqlalchemy import text
    from app.db.session import async_session

    db_status = "ok"
    redis_status = "ok"
    try:
        async with async_session() as session:
            await session.execute(text("SELECT 1"))
    except Exception:
        db_status = "error"

    try:
        from redis import Redis
        from app.core.config import settings as _settings
        r = Redis.from_url(_settings.REDIS_URL, socket_connect_timeout=2)
        r.ping()
    except Exception:
        redis_status = "error"

    status_overall = "ok" if db_status == "ok" and redis_status == "ok" else "degraded"
    return {"status": status_overall, "db": db_status, "redis": redis_status}


@app.get("/api/health/ready")
async def health_ready():
    from sqlalchemy import text
    from app.db.session import async_session

    try:
        async with async_session() as session:
            await session.execute(text("SELECT 1"))
        return {"status": "ok", "db": "ok"}
    except Exception:
        from fastapi.responses import JSONResponse
        return JSONResponse(
            status_code=503,
            content={"status": "not_ready"},
        )
