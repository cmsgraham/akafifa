from datetime import datetime

from pydantic import BaseModel, Field


class PredictionCreate(BaseModel):
    home_score: int = Field(ge=0)
    away_score: int = Field(ge=0)


class PredictionUpdate(BaseModel):
    home_score: int = Field(ge=0)
    away_score: int = Field(ge=0)


class PredictionResponse(BaseModel):
    id: str
    match_id: str
    home_score: int
    away_score: int
    points: int | None
    result_type: str | None
    submitted_at: datetime
