from datetime import datetime, timezone


def calculate_lock_at(kickoff_utc: datetime, lockout_hours: float) -> datetime:
    """Return the UTC timestamp before which predictions are still editable."""
    from datetime import timedelta

    return kickoff_utc - timedelta(hours=lockout_hours)


def is_prediction_editable(lock_at: datetime, now: datetime | None = None) -> bool:
    """Return True if the current time is strictly before lock_at."""
    if now is None:
        now = datetime.now(timezone.utc)
    return now < lock_at
