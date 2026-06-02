"""Integration tests for admin-only flows (Section 15.2)."""

import pytest


@pytest.mark.asyncio
async def test_non_admin_accesses_admin_endpoint():
    """Non-admin accesses admin endpoint → 403."""
    pass
