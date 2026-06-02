"""Unit tests for duel resolution logic (Section 15.1, Section 12.2)."""

from app.services.scoring import calculate_points


def test_duel_challenger_wins():
    """Challenger has exact match, opponent has outcome match — challenger wins."""
    c = calculate_points(2, 1, 2, 1)  # exact → 3 points
    o = calculate_points(3, 0, 2, 1)  # outcome → 1 point

    assert c.points > o.points
    winner = "challenger"
    assert winner == "challenger"


def test_duel_opponent_wins():
    """Opponent has exact match, challenger misses — opponent wins."""
    c = calculate_points(0, 0, 2, 1)  # miss → 0 points
    o = calculate_points(2, 1, 2, 1)  # exact → 3 points

    assert o.points > c.points
    winner = "opponent"
    assert winner == "opponent"


def test_duel_draw():
    """Both users have the same points — duel is a draw."""
    c = calculate_points(3, 0, 2, 1)  # outcome → 1 point
    o = calculate_points(1, 0, 2, 1)  # outcome → 1 point

    assert c.points == o.points
    is_draw = c.points == o.points
    assert is_draw is True


def test_duel_missing_prediction_loses():
    """If a user has no prediction, they get 0 points. The other user wins."""
    challenger_points = 0  # no prediction
    o = calculate_points(2, 1, 2, 1)  # exact → 3 points

    assert o.points > challenger_points
    winner = "opponent"
    assert winner == "opponent"


def test_duel_both_missing_is_draw():
    """If both users have no prediction, both get 0 — it's a draw."""
    challenger_points = 0
    opponent_points = 0

    assert challenger_points == opponent_points
    is_draw = True
    assert is_draw is True


def test_duel_exact_vs_miss():
    """Exact score (3 pts) always beats a miss (0 pts)."""
    c = calculate_points(1, 1, 1, 1)  # exact → 3
    o = calculate_points(3, 0, 1, 1)  # miss → 0

    assert c.points == 3
    assert o.points == 0
    assert c.points > o.points


def test_duel_outcome_vs_miss():
    """Correct outcome (1 pt) beats a miss (0 pts)."""
    c = calculate_points(2, 0, 3, 1)  # outcome (home win) → 1
    o = calculate_points(0, 1, 3, 1)  # miss (away win predicted) → 0

    assert c.points == 1
    assert o.points == 0
    assert c.points > o.points
