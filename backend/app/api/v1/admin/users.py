from fastapi import APIRouter

router = APIRouter(prefix="/api/admin/users", tags=["admin-users"])


@router.get("/{user_id}")
async def get_user(user_id: str):
    # TODO: implement admin user view
    return {"user_id": user_id}


@router.put("/{user_id}/role")
async def update_role(user_id: str):
    # TODO: implement role change with self-demotion check
    return {"message": "Role updated"}


@router.post("/{user_id}/reset-password")
async def admin_reset_password(user_id: str):
    # TODO: trigger password reset for user
    return {"message": "Password reset triggered"}


@router.post("/{user_id}/resend-email")
async def resend_email(user_id: str):
    # TODO: resend welcome/reminder email
    return {"message": "Email resent"}


@router.post("/{user_id}/unlock")
async def unlock_user(user_id: str):
    # TODO: unlock rate-limited / suspended user
    return {"message": "User unlocked"}
