from pydantic import BaseModel


class LeaderboardEntry(BaseModel):
    rank: int
    user_id: str
    display_name: str
    avatar_path: str | None
    total_points: int
    exact_hits: int
    outcome_hits: int


class LeaderboardResponse(BaseModel):
    data: list[LeaderboardEntry]
    pagination: dict
