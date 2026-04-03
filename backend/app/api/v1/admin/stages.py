from fastapi import APIRouter

router = APIRouter(prefix="/api/admin/stages", tags=["admin-stages"])


@router.post("/{stage_id}/freeze")
async def freeze_stage(stage_id: str):
    # TODO: implement stage freezing + leaderboard snapshot
    return {"message": "Stage frozen"}
