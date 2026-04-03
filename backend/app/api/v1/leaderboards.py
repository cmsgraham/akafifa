from fastapi import APIRouter

router = APIRouter(prefix="/api/leaderboards", tags=["leaderboards"])


@router.get("/global")
async def global_leaderboard():
    # TODO: implement with Redis cache + DB fallback
    return {"data": [], "pagination": {"next_cursor": None, "has_more": False}}


@router.get("/tournament/{tournament_id}")
async def tournament_leaderboard(tournament_id: str):
    return {"data": [], "pagination": {"next_cursor": None, "has_more": False}}


@router.get("/stage/{stage_id}")
async def stage_leaderboard(stage_id: str):
    return {"data": [], "pagination": {"next_cursor": None, "has_more": False}}
