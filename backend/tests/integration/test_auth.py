"""Integration tests for authentication flows (Section 15.2)."""

import pytest


@pytest.mark.asyncio
async def test_register_valid_domain():
    """Register with valid email domain → User created (201)."""
    # TODO: implement with test client
    pass


@pytest.mark.asyncio
async def test_register_blocked_domain():
    """Register with blocked email domain → 403."""
    pass


@pytest.mark.asyncio
async def test_login_sets_cookie():
    """Login → access token cookie set (200)."""
    pass


@pytest.mark.asyncio
async def test_refresh_rotates_token():
    """Refresh → new token issued, old invalidated (200)."""
    pass


@pytest.mark.asyncio
async def test_logout_clears_cookies():
    """Logout → token invalidated (200)."""
    pass


@pytest.mark.asyncio
async def test_forgot_password_issues_link():
    """Forgot password → reset link issued (200)."""
    pass


@pytest.mark.asyncio
async def test_reset_password_valid_token():
    """Reset password with valid token → password updated."""
    pass


@pytest.mark.asyncio
async def test_reset_password_expired_token():
    """Reset password with expired token → 400."""
    pass
