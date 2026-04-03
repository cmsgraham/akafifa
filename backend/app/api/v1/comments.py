from fastapi import APIRouter

router = APIRouter(prefix="/api", tags=["comments"])


@router.get("/matches/{match_id}/comments")
async def list_comments(match_id: str):
    # TODO: implement paginated comments
    return {"data": [], "pagination": {"next_cursor": None, "has_more": False}}


@router.post("/matches/{match_id}/comments", status_code=201)
async def create_comment(match_id: str):
    # TODO: implement comment creation with rate limit
    return {"message": "Comment created"}


@router.put("/comments/{comment_id}")
async def update_comment(comment_id: str):
    # TODO: implement with grace period check
    return {"message": "Comment updated"}


@router.delete("/comments/{comment_id}")
async def delete_comment(comment_id: str):
    # TODO: implement with grace period / admin bypass
    return {"message": "Comment deleted"}
