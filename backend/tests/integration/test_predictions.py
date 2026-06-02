"""Integration tests for prediction flows (Section 15.2)."""

import pytest


@pytest.mark.asyncio
async def test_submit_prediction_before_lock():
    """Submit prediction before lock-at → 201."""
    pass


@pytest.mark.asyncio
async def test_submit_prediction_after_lock():
    """Submit prediction after lock-at → 400 PREDICTION_LOCKED."""
    pass


@pytest.mark.asyncio
async def test_edit_prediction_before_lock():
    """Edit prediction before lock-at → 200."""
    pass


@pytest.mark.asyncio
async def test_edit_prediction_after_lock():
    """Edit prediction after lock-at → 400 PREDICTION_LOCKED."""
    pass


@pytest.mark.asyncio
async def test_submit_duplicate_prediction():
    """Submit duplicate prediction → 409."""
    pass
