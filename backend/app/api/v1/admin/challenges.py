from fastapi import APIRouter

router = APIRouter(prefix="/api/admin/challenges", tags=["admin-challenges"])


@router.post("")
async def create_challenge():
    # TODO: implement challenge creation
    return {"message": "Challenge created"}


@router.put("/{challenge_id}")
async def update_challenge(challenge_id: str):
    # TODO: implement challenge update
    return {"message": "Challenge updated"}


@router.post("/{challenge_id}/resolve")
async def resolve_challenge(challenge_id: str):
    # TODO: implement challenge resolution
    return {"message": "Challenge resolved"}


@router.delete("/{challenge_id}")
async def delete_challenge(challenge_id: str):
    # TODO: implement challenge deletion
    return {"message": "Challenge deleted"}
