from fastapi import APIRouter

router = APIRouter(prefix="/api/admin/settings", tags=["admin-settings"])


@router.put("/lockout")
async def update_lockout():
    # TODO: implement lockout hours configuration
    return {"message": "Lockout updated"}
