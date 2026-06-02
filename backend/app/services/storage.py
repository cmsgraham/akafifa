import io
import uuid
from datetime import datetime

import boto3
from PIL import Image

from app.core.config import settings

ALLOWED_CONTENT_TYPES = {"image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"}


def _get_s3_client():
    return boto3.client(
        "s3",
        region_name=settings.S3_REGION,
        endpoint_url=settings.S3_ENDPOINT_URL or None,
        aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
        aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
    )


def process_image(raw: bytes, max_dim: int | None = None) -> bytes:
    """Validate, resize, and compress an image. Returns JPEG bytes."""
    img = Image.open(io.BytesIO(raw))
    img.verify()
    img = Image.open(io.BytesIO(raw))

    # Strip EXIF orientation and convert
    img = img.convert("RGB")

    max_dim = max_dim or settings.MEDIA_MAX_DIMENSION
    if img.width > max_dim or img.height > max_dim:
        img.thumbnail((max_dim, max_dim), Image.LANCZOS)

    buf = io.BytesIO()
    img.save(buf, "JPEG", quality=82, optimize=True)
    buf.seek(0)
    return buf.read()


def upload_media(jpeg_bytes: bytes, folder: str = "media") -> str:
    """Upload processed JPEG bytes to S3 and return the public URL."""
    key = f"{folder}/{datetime.utcnow():%Y/%m}/{uuid.uuid4().hex}.jpg"
    client = _get_s3_client()
    client.put_object(
        Bucket=settings.MEDIA_BUCKET,
        Key=key,
        Body=jpeg_bytes,
        ContentType="image/jpeg",
        ACL="public-read",
    )
    # Linode Object Storage public URL pattern
    return f"{settings.S3_ENDPOINT_URL}/{settings.MEDIA_BUCKET}/{key}"


def upload_profile_image(jpeg_bytes: bytes, key: str) -> str:
    """Upload a profile image (avatar or cover) to S3 with a deterministic key."""
    client = _get_s3_client()
    client.put_object(
        Bucket=settings.MEDIA_BUCKET,
        Key=key,
        Body=jpeg_bytes,
        ContentType="image/jpeg",
        ACL="public-read",
        CacheControl="public, max-age=60",
    )
    return f"{settings.S3_ENDPOINT_URL}/{settings.MEDIA_BUCKET}/{key}"


def delete_s3_object(key: str) -> None:
    """Delete an object from S3 by key."""
    client = _get_s3_client()
    client.delete_object(Bucket=settings.MEDIA_BUCKET, Key=key)
