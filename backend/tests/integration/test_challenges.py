"""Integration tests for flash challenge flows (Section 15.2)."""

import pytest


@pytest.mark.asyncio
async def test_answer_before_close():
    """Flash challenge answer before close_at → 201."""
    pass


@pytest.mark.asyncio
async def test_answer_after_close():
    """Flash challenge answer after close_at → 400."""
    pass


@pytest.mark.asyncio
async def test_admin_resolves_challenge():
    """Admin resolves flash challenge; points awarded to correct answers."""
    pass
