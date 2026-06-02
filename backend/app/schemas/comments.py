from datetime import datetime

from pydantic import BaseModel, Field


class CommentCreate(BaseModel):
    body: str = Field(max_length=500)


class CommentUpdate(BaseModel):
    body: str = Field(max_length=500)


class CommentResponse(BaseModel):
    id: str
    match_id: str
    user_id: str
    body: str
    created_at: datetime
    updated_at: datetime
