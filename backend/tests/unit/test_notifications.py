"""Unit tests for the notification service layer."""

import uuid
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.services.notifications import (
    DEDUP_WINDOW_SECONDS,
    NotifType,
    _TYPE_CATEGORY,
    _TYPE_PRIORITY,
    notify,
    notify_many,
)


def _make_mock_db(dedup_count: int = 0):
    """Create a mock AsyncSession."""
    db = AsyncMock()
    # For dedup check: execute returns a result with scalar_one() = dedup_count
    result_mock = MagicMock()
    result_mock.scalar_one.return_value = dedup_count
    db.execute.return_value = result_mock
    return db


@pytest.mark.asyncio
async def test_notify_creates_notification():
    db = _make_mock_db(dedup_count=0)
    user_id = uuid.uuid4()

    result = await notify(
        db,
        user_id=user_id,
        type=NotifType.DUEL_INVITATION,
        title="Test",
        message="Test message",
        dedup_key="test_key",
    )

    assert result is not None
    assert result.user_id == user_id
    assert result.category == "duel"
    assert result.priority == "high"
    db.add.assert_called_once()


@pytest.mark.asyncio
async def test_notify_dedup_suppresses():
    db = _make_mock_db(dedup_count=1)
    user_id = uuid.uuid4()

    result = await notify(
        db,
        user_id=user_id,
        type=NotifType.DUEL_INVITATION,
        title="Test",
        message="Test message",
        dedup_key="test_key",
    )

    assert result is None
    db.add.assert_not_called()


@pytest.mark.asyncio
async def test_notify_no_dedup_key_skips_check():
    db = AsyncMock()
    user_id = uuid.uuid4()

    result = await notify(
        db,
        user_id=user_id,
        type=NotifType.COMMENT_REPLY,
        title="Reply",
        message="Someone replied",
    )

    assert result is not None
    assert result.category == "social"
    assert result.priority == "normal"
    # execute should not be called (no dedup check)
    db.execute.assert_not_called()


@pytest.mark.asyncio
async def test_notify_many():
    db = AsyncMock()
    user_ids = [uuid.uuid4() for _ in range(3)]

    count = await notify_many(
        db,
        user_ids=user_ids,
        type=NotifType.ADMIN_ANNOUNCEMENT,
        title="Announcement",
        message="Test broadcast",
    )

    assert count == 3
    assert db.add.call_count == 3


def test_type_category_mapping():
    """Ensure all NotifType constants have a category mapping."""
    for attr in dir(NotifType):
        if attr.startswith("_"):
            continue
        val = getattr(NotifType, attr)
        assert val in _TYPE_CATEGORY, f"{attr}={val} missing from _TYPE_CATEGORY"


def test_category_values():
    """All categories must be valid."""
    valid = {"social", "match", "duel", "challenge", "system"}
    for k, v in _TYPE_CATEGORY.items():
        assert v in valid, f"Invalid category '{v}' for type '{k}'"
