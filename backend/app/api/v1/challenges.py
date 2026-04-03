from fastapi import APIRouter

router = APIRouter(prefix="/api", tags=["challenges"])


@router.get("/challenges/active")
async def active_challenges():
    # TODO: implement active challenge listing
    return {"data": []}


@router.post("/challenges/{challenge_id}/answer", status_code=201)
async def answer_challenge(challenge_id: str):
    # TODO: implement answer submission with time check
    return {"message": "Answer submitted"}


@router.get("/me/challenges")
async def my_challenges():
    # TODO: implement user challenge listing
    return {"data": []}
