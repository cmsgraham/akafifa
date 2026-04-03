from fastapi import APIRouter

router = APIRouter(prefix="/api/admin/matches", tags=["admin-matches"])


@router.post("/sync")
async def sync_matches():
    # TODO: trigger external API sync
    return {"message": "Sync triggered"}


@router.put("/{match_id}/result")
async def override_result(match_id: str):
    # TODO: implement result override
    return {"message": "Result overridden"}


@router.post("/{match_id}/recalculate")
async def recalculate(match_id: str):
    # TODO: trigger score recalculation
    return {"message": "Recalculation started"}
