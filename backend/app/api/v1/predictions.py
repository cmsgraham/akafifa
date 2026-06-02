from typing import Annotated
from datetime import datetime, timezone as tz

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user
from app.db.models import Match, Prediction, Team, Tournament, User
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


@router.delete("/matches/{match_id}/prediction")
async def delete_prediction(
    match_id: str,
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
        raise HTTPException(status_code=404, detail="No prediction found to delete")

    await db.delete(prediction)
    return {"message": "Prediction deleted"}


@router.get("/matches/{match_id}/prediction")
async def get_prediction(
    match_id: str,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    result = await db.execute(
        select(Prediction).where(
            Prediction.user_id == current_user.id,
            Prediction.match_id == match_id,
        )
    )
    prediction = result.scalar_one_or_none()
    if not prediction:
        return {"data": None}
    return {
        "data": {
            "id": str(prediction.id),
            "match_id": str(prediction.match_id),
            "home_score": prediction.home_score,
            "away_score": prediction.away_score,
            "points": prediction.points,
            "result_type": prediction.result_type,
        }
    }


from sqlalchemy.orm import aliased

_HomeTeam = aliased(Team)
_AwayTeam = aliased(Team)


@router.get("/me/predictions")
async def my_predictions(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    stmt = (
        select(Prediction, _HomeTeam.name, _AwayTeam.name, Tournament.name, Tournament.id, Match.kickoff_utc, Match.lock_at, Match.status)
        .join(Match, Prediction.match_id == Match.id)
        .join(_HomeTeam, Match.home_team_id == _HomeTeam.id)
        .join(_AwayTeam, Match.away_team_id == _AwayTeam.id)
        .join(Tournament, Match.tournament_id == Tournament.id)
        .where(Prediction.user_id == current_user.id)
        .order_by(Tournament.name, Match.kickoff_utc.desc())
    )
    rows = await db.execute(stmt)
    return {
        "data": [
            {
                "id": str(p.id),
                "match_id": str(p.match_id),
                "home_team": home_name,
                "away_team": away_name,
                "home_score": p.home_score,
                "away_score": p.away_score,
                "points": p.points,
                "result_type": p.result_type,
                "submitted_at": p.submitted_at.isoformat(),
                "tournament_name": t_name,
                "tournament_id": str(t_id),
                "kickoff_utc": kickoff.isoformat(),
                "lock_at": lock.isoformat(),
                "match_status": m_status,
            }
            for p, home_name, away_name, t_name, t_id, kickoff, lock, m_status in rows.all()
        ]
    }


@router.get("/users/{user_id}/predictions")
async def user_predictions(
    user_id: str,
    db: Annotated[AsyncSession, Depends(get_db)],
    _current_user: Annotated[User, Depends(get_current_user)],
):
    now = datetime.now(tz.utc)
    stmt = (
        select(Prediction, _HomeTeam.name, _AwayTeam.name, Tournament.name, Tournament.id, Match.kickoff_utc, Match.lock_at, Match.status)
        .join(Match, Prediction.match_id == Match.id)
        .join(_HomeTeam, Match.home_team_id == _HomeTeam.id)
        .join(_AwayTeam, Match.away_team_id == _AwayTeam.id)
        .join(Tournament, Match.tournament_id == Tournament.id)
        .where(Prediction.user_id == user_id)
        .where(Match.lock_at <= now)
        .order_by(Tournament.name, Match.kickoff_utc.desc())
    )
    rows = await db.execute(stmt)
    return {
        "data": [
            {
                "id": str(p.id),
                "match_id": str(p.match_id),
                "home_team": home_name,
                "away_team": away_name,
                "home_score": p.home_score,
                "away_score": p.away_score,
                "points": p.points,
                "result_type": p.result_type,
                "submitted_at": p.submitted_at.isoformat(),
                "tournament_name": t_name,
                "tournament_id": str(t_id),
                "kickoff_utc": kickoff.isoformat(),
                "lock_at": lock.isoformat(),
                "match_status": m_status,
            }
            for p, home_name, away_name, t_name, t_id, kickoff, lock, m_status in rows.all()
        ]
    }
