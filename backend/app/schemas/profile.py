from uuid import UUID

from pydantic import BaseModel, Field


class ProfileUpdate(BaseModel):
    display_name: str | None = None
    bio: str | None = None
    favorite_team_id: UUID | None = None


class ProfileResponse(BaseModel):
    user_id: str
    display_name: str
    avatar_path: str | None
    bio: str | None
    favorite_team_id: str | None
    total_points: int
    exact_hits: int
    outcome_hits: int
    duel_wins: int
    duel_losses: int
    duel_draws: int
