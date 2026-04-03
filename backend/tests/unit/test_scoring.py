from app.services.scoring import ScoringConfig, calculate_points


def test_exact_score():
    result = calculate_points(2, 1, 2, 1)
    assert result.points == 3
    assert result.result_type == "exact"
    assert result.metadata["exact"] is True


def test_correct_outcome_home_win():
    result = calculate_points(3, 0, 2, 1)
    assert result.points == 1
    assert result.result_type == "outcome"


def test_correct_outcome_draw():
    result = calculate_points(1, 1, 0, 0)
    assert result.points == 1
    assert result.result_type == "outcome"


def test_correct_outcome_away_win():
    result = calculate_points(0, 1, 1, 3)
    assert result.points == 1
    assert result.result_type == "outcome"


def test_miss():
    result = calculate_points(2, 0, 0, 1)
    assert result.points == 0
    assert result.result_type == "miss"


def test_custom_config():
    config = ScoringConfig(exact_points=5, outcome_points=2)
    result = calculate_points(1, 0, 1, 0, config)
    assert result.points == 5
    assert result.result_type == "exact"


def test_custom_knockout_bonus():
    config = ScoringConfig(exact_points=3, knockout_bonus=2)
    result = calculate_points(1, 0, 1, 0, config)
    assert result.points == 5  # 3 + 2


def test_round_multiplier():
    config = ScoringConfig(exact_points=3, round_multiplier=2.0)
    result = calculate_points(1, 0, 1, 0, config)
    assert result.points == 6  # 3 * 2.0
