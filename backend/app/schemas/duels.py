from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class DuelCreate(BaseModel):
    opponent_id: UUID
    stake_points: int = Field(..., ge=1, le=50)


class DuelResponse(BaseModel):
    id: str
    match_id: str
    challenger_id: str
    opponent_id: str
    stake_points: int
    status: str
    winner_id: str | None
    challenger_score: int | None
    opponent_score: int | None
    resolved_at: datetime | None
    expires_at: datetime
    created_at: datetime
