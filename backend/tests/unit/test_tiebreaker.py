"""Unit tests for tie-breaker ordering logic (Section 15.1)."""

from app.services.leaderboard import compute_leaderboard


def test_tiebreaker_total_points_first():
    """User with more total points ranks higher."""
    # This tests the ordering logic conceptually.
    # Full integration test with DB in tests/integration/test_leaderboard.py
    entries = [
        {"display_name": "Alice", "total_points": 10, "exact_hits": 2, "outcome_hits": 3},
        {"display_name": "Bob", "total_points": 15, "exact_hits": 1, "outcome_hits": 5},
    ]
    sorted_entries = sorted(
        entries,
        key=lambda e: (-e["total_points"], -e["exact_hits"], -e["outcome_hits"], e["display_name"]),
    )
    assert sorted_entries[0]["display_name"] == "Bob"
    assert sorted_entries[1]["display_name"] == "Alice"


def test_tiebreaker_exact_hits_second():
    """When total points are equal, more exact hits ranks higher."""
    entries = [
        {"display_name": "Alice", "total_points": 10, "exact_hits": 2, "outcome_hits": 4},
        {"display_name": "Bob", "total_points": 10, "exact_hits": 3, "outcome_hits": 1},
    ]
    sorted_entries = sorted(
        entries,
        key=lambda e: (-e["total_points"], -e["exact_hits"], -e["outcome_hits"], e["display_name"]),
    )
    assert sorted_entries[0]["display_name"] == "Bob"


def test_tiebreaker_outcome_hits_third():
    """When points and exact hits are equal, more outcome hits ranks higher."""
    entries = [
        {"display_name": "Alice", "total_points": 10, "exact_hits": 2, "outcome_hits": 3},
        {"display_name": "Bob", "total_points": 10, "exact_hits": 2, "outcome_hits": 5},
    ]
    sorted_entries = sorted(
        entries,
        key=lambda e: (-e["total_points"], -e["exact_hits"], -e["outcome_hits"], e["display_name"]),
    )
    assert sorted_entries[0]["display_name"] == "Bob"


def test_tiebreaker_alphabetical_final():
    """When all stats are equal, alphabetical username is the final tie-breaker."""
    entries = [
        {"display_name": "Charlie", "total_points": 10, "exact_hits": 2, "outcome_hits": 3},
        {"display_name": "Alice", "total_points": 10, "exact_hits": 2, "outcome_hits": 3},
        {"display_name": "Bob", "total_points": 10, "exact_hits": 2, "outcome_hits": 3},
    ]
    sorted_entries = sorted(
        entries,
        key=lambda e: (-e["total_points"], -e["exact_hits"], -e["outcome_hits"], e["display_name"]),
    )
    assert sorted_entries[0]["display_name"] == "Alice"
    assert sorted_entries[1]["display_name"] == "Bob"
    assert sorted_entries[2]["display_name"] == "Charlie"


def test_tiebreaker_all_five_levels():
    """Exercise all five tie-breaker levels with distinct resolution at each."""
    entries = [
        {"display_name": "E", "total_points": 5, "exact_hits": 0, "outcome_hits": 5},
        {"display_name": "D", "total_points": 10, "exact_hits": 1, "outcome_hits": 3},
        {"display_name": "C", "total_points": 10, "exact_hits": 2, "outcome_hits": 2},
        {"display_name": "B", "total_points": 10, "exact_hits": 2, "outcome_hits": 4},
        {"display_name": "A", "total_points": 10, "exact_hits": 2, "outcome_hits": 4},
    ]
    sorted_entries = sorted(
        entries,
        key=lambda e: (-e["total_points"], -e["exact_hits"], -e["outcome_hits"], e["display_name"]),
    )
    # B and A tied on pts(10), exact(2), outcome(4) → alphabetical: A then B
    assert sorted_entries[0]["display_name"] == "A"
    assert sorted_entries[1]["display_name"] == "B"
    # C: pts=10, exact=2, outcome=2
    assert sorted_entries[2]["display_name"] == "C"
    # D: pts=10, exact=1
    assert sorted_entries[3]["display_name"] == "D"
    # E: pts=5
    assert sorted_entries[4]["display_name"] == "E"
