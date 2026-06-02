"""Integration tests for leaderboard flows (Section 15.2)."""

import pytest


@pytest.mark.asyncio
async def test_global_leaderboard_tiebreaking():
    """Global leaderboard respects tie-breaking order → correct order verified."""
    pass


@pytest.mark.asyncio
async def test_stage_leaderboard_frozen():
    """Stage leaderboard after freeze call → returns snapshot; live changes excluded."""
    pass
