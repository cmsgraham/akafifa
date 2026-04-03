from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user
from app.db.models import Match, Prediction, User
from app.db.session import get_db
from app.services.lockout import is_prediction_editable

router = APIRouter(prefix="/api", tags=["predictions"])


class PredictionRequest(BaseModel):
    home_score: int = Field(ge=0)
    away_score: int = Field(ge=0)


@router.post("/matches/{match_id}/prediction", status_code=status.HTTP_201_CREATED)
async def create_prediction(
    match_id: str,
    body: PredictionRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    match = await db.get(Match, match_id)
    if not match:
        raise HTTPException(status_code=404, detail="Match not found")

    if not is_prediction_editable(match.lock_at):
        raise HTTPException(
            status_code=400,
            detail={"code": "PREDICTION_LOCKED", "message": "This match is no longer accepting predictions."},
        )

    # Check for existing prediction
    existing = await db.execute(
        select(Prediction).where(
            Prediction.user_id == current_user.id,
            Prediction.match_id == match.id,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Prediction already exists. Use PUT to update.")

    prediction = Prediction(
        user_id=current_user.id,
        match_id=match.id,
        home_score=body.home_score,
        away_score=body.away_score,
    )
    db.add(prediction)
    return {"message": "Prediction created", "prediction_id": str(prediction.id)}


@router.put("/matches/{match_id}/prediction")
async def update_prediction(
    match_id: str,
    body: PredictionRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    match = await db.get(Match, match_id)
    if not match:
        raise HTTPException(status_code=404, detail="Match not found")

    if not is_prediction_editable(match.lock_at):
        raise HTTPException(
            status_code=400,
            detail={"code": "PREDICTION_LOCKED", "message": "This match is no longer accepting predictions."},
        )

    result = await db.execute(
        select(Prediction).where(
            Prediction.user_id == current_user.id,
            Prediction.match_id == match.id,
        )
    )
    prediction = result.scalar_one_or_none()
    if not prediction:
        raise HTTPException(status_code=404, detail="No prediction found to update")

    prediction.home_score = body.home_score
    prediction.away_score = body.away_score
    return {"message": "Prediction updated"}


@router.get("/me/predictions")
async def my_predictions(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    result = await db.execute(
        select(Prediction).where(Prediction.user_id == current_user.id)
    )
    predictions = result.scalars().all()
    return {
        "data": [
            {
                "id": str(p.id),
                "match_id": str(p.match_id),
                "home_score": p.home_score,
                "away_score": p.away_score,
                "points": p.points,
                "result_type": p.result_type,
                "submitted_at": p.submitted_at.isoformat(),
            }
            for p in predictions
        ]
    }
