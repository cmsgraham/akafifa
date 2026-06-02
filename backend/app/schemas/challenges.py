from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class ChallengeAnswerRequest(BaseModel):
    option_id: UUID


class ChallengeResponse(BaseModel):
    id: str
    title: str
    description: str | None
    type: str
    scope: str
    points_value: int
    open_at: datetime
    close_at: datetime
    status: str
    options: list[dict]


class ChallengeAnswerResponse(BaseModel):
    id: str
    challenge_id: str
    option_id: str
    points_awarded: int | None
    submitted_at: datetime
