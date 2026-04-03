from fastapi import APIRouter

router = APIRouter(prefix="/api", tags=["profile"])


@router.get("/me/profile")
async def get_profile():
    # TODO: implement profile retrieval
    return {}


@router.put("/me/profile")
async def update_profile():
    # TODO: implement profile update
    return {"message": "Profile updated"}


@router.post("/me/avatar")
async def upload_avatar():
    # TODO: implement avatar upload with validation
    return {"message": "Avatar uploaded"}
