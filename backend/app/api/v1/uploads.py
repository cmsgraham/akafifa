from fastapi import APIRouter, Depends, HTTPException, UploadFile, File

from app.core.config import settings
from app.core.dependencies import get_current_user
from app.db.models import User
from app.services.storage import ALLOWED_CONTENT_TYPES, process_image, upload_media

router = APIRouter(prefix="/api", tags=["uploads"])

MAX_SIZE = settings.MEDIA_MAX_SIZE_MB * 1024 * 1024


@router.post("/uploads/image")
async def upload_image(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
):
    """Upload an image, resize/compress it, store in S3, return the public URL."""
    if file.content_type not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(status_code=400, detail="Only JPEG, PNG, WebP, or HEIC images are allowed")

    raw = await file.read()
    if len(raw) > MAX_SIZE:
        raise HTTPException(
            status_code=400,
            detail=f"File too large (max {settings.MEDIA_MAX_SIZE_MB} MB)",
        )

    try:
        jpeg_bytes = process_image(raw)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid or corrupted image file")

    url = upload_media(jpeg_bytes)
    return {"url": url}
