from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.api.v1 import auth, matches, predictions, leaderboards, comments, duels, challenges, profile
from app.api.v1.admin import (
    matches as admin_matches,
    challenges as admin_challenges,
    users as admin_users,
    stages as admin_stages,
    settings as admin_settings,
)

app = FastAPI(
    title="The Tournament Hub",
    version="0.1.0",
    docs_url="/api/docs" if settings.APP_ENV == "local" else None,
    redoc_url="/api/redoc" if settings.APP_ENV == "local" else None,
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

# ── Admin routers ────────────────────────────────────────────────────────────
app.include_router(admin_matches.router)
app.include_router(admin_challenges.router)
app.include_router(admin_users.router)
app.include_router(admin_stages.router)
app.include_router(admin_settings.router)


# ── Health endpoints ─────────────────────────────────────────────────────────
@app.get("/api/health")
async def health():
    return {"status": "ok"}


@app.get("/api/health/ready")
async def health_ready():
    from sqlalchemy import text
    from app.db.session import async_session

    try:
        async with async_session() as session:
            await session.execute(text("SELECT 1"))
        return {"status": "ok", "db": "ok"}
    except Exception as e:
        return {"status": "error", "db": str(e)}
