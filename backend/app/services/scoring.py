from dataclasses import dataclass, field
from typing import Literal


@dataclass
class ScoringConfig:
    exact_points: int = 3
    outcome_points: int = 1
    # Extensibility hooks (all disabled in v1):
    underdog_multiplier: float = 1.0
    knockout_bonus: int = 0
    round_multiplier: float = 1.0


DEFAULT_CONFIG = ScoringConfig()


@dataclass
class ScoringResult:
    points: int
    result_type: Literal["exact", "outcome", "miss"]
    metadata: dict = field(default_factory=dict)


def calculate_points(
    predicted_home: int,
    predicted_away: int,
    actual_home: int,
    actual_away: int,
    config: ScoringConfig = DEFAULT_CONFIG,
) -> ScoringResult:
    """Score a single prediction against the actual result."""
    # Exact score match
    if predicted_home == actual_home and predicted_away == actual_away:
        pts = int(config.exact_points * config.round_multiplier * config.underdog_multiplier)
        pts += config.knockout_bonus
        return ScoringResult(
            points=pts,
            result_type="exact",
            metadata={"exact": True, "outcome": True},
        )

    # Check outcome match
    predicted_outcome = _outcome(predicted_home, predicted_away)
    actual_outcome = _outcome(actual_home, actual_away)

    if predicted_outcome == actual_outcome:
        pts = int(config.outcome_points * config.round_multiplier * config.underdog_multiplier)
        pts += config.knockout_bonus
        return ScoringResult(
            points=pts,
            result_type="outcome",
            metadata={"exact": False, "outcome": True},
        )

    return ScoringResult(
        points=0,
        result_type="miss",
        metadata={"exact": False, "outcome": False},
    )


def _outcome(home: int, away: int) -> str:
    if home > away:
        return "home"
    elif home < away:
        return "away"
    return "draw"
