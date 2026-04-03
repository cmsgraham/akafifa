from fastapi import APIRouter

router = APIRouter(prefix="/api", tags=["duels"])


@router.post("/matches/{match_id}/duels", status_code=201)
async def create_duel(match_id: str):
    # TODO: implement duel creation
    return {"message": "Duel created"}


@router.post("/duels/{duel_id}/accept")
async def accept_duel(duel_id: str):
    # TODO: implement accept with expiry check
    return {"message": "Duel accepted"}


@router.post("/duels/{duel_id}/decline")
async def decline_duel(duel_id: str):
    # TODO: implement decline
    return {"message": "Duel declined"}


@router.get("/me/duels")
async def my_duels():
    # TODO: implement duel listing
    return {"data": []}
