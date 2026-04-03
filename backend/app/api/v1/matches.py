from fastapi import APIRouter

router = APIRouter(prefix="/api", tags=["matches"])


@router.get("/tournaments/{tournament_id}/matches")
async def list_matches(tournament_id: str):
    # TODO: implement match listing with pagination
    return {"data": [], "pagination": {"next_cursor": None, "has_more": False}}


@router.get("/matches/{match_id}")
async def get_match(match_id: str):
    # TODO: implement match detail
    return {"match_id": match_id}
