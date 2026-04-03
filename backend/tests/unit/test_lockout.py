from datetime import datetime, timedelta, timezone

from app.services.lockout import calculate_lock_at, is_prediction_editable


def test_calculate_lock_at():
    kickoff = datetime(2026, 6, 15, 18, 0, 0, tzinfo=timezone.utc)
    lock_at = calculate_lock_at(kickoff, lockout_hours=1.0)
    assert lock_at == datetime(2026, 6, 15, 17, 0, 0, tzinfo=timezone.utc)


def test_calculate_lock_at_fractional_hours():
    kickoff = datetime(2026, 6, 15, 18, 0, 0, tzinfo=timezone.utc)
    lock_at = calculate_lock_at(kickoff, lockout_hours=0.5)
    assert lock_at == datetime(2026, 6, 15, 17, 30, 0, tzinfo=timezone.utc)


def test_is_editable_before_lock():
    lock_at = datetime(2026, 6, 15, 17, 0, 0, tzinfo=timezone.utc)
    now = datetime(2026, 6, 15, 16, 59, 59, tzinfo=timezone.utc)
    assert is_prediction_editable(lock_at, now) is True


def test_is_not_editable_at_exact_lock():
    lock_at = datetime(2026, 6, 15, 17, 0, 0, tzinfo=timezone.utc)
    now = datetime(2026, 6, 15, 17, 0, 0, tzinfo=timezone.utc)
    assert is_prediction_editable(lock_at, now) is False


def test_is_not_editable_after_lock():
    lock_at = datetime(2026, 6, 15, 17, 0, 0, tzinfo=timezone.utc)
    now = datetime(2026, 6, 15, 17, 0, 1, tzinfo=timezone.utc)
    assert is_prediction_editable(lock_at, now) is False


def test_one_second_before_lock():
    lock_at = datetime(2026, 6, 15, 17, 0, 0, tzinfo=timezone.utc)
    now = lock_at - timedelta(seconds=1)
    assert is_prediction_editable(lock_at, now) is True


def test_one_second_after_lock():
    lock_at = datetime(2026, 6, 15, 17, 0, 0, tzinfo=timezone.utc)
    now = lock_at + timedelta(seconds=1)
    assert is_prediction_editable(lock_at, now) is False
