from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class MatchResponse(BaseModel):
    id: str
    tournament_id: str
    stage_id: str
    home_team_id: str
    away_team_id: str
    kickoff_utc: datetime
    lock_at: datetime
    venue: str | None
    status: str
    external_id: str | None


class MatchResultResponse(BaseModel):
    home_score: int
    away_score: int
    is_override: bool
    confirmed_at: datetime
