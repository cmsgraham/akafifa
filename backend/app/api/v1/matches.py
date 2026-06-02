from datetime import timedelta
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import case, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import aliased

from app.core.dependencies import get_current_user
from app.db.models import AppSetting, Match, MatchResult, Prediction, Stage, Team, Tournament, User
from app.db.session import get_db
from app.services.email.sender import send_email

# Minimum predictions required before community odds are shown to end users.
COMMUNITY_ODDS_MIN_PREDICTIONS = 5

router = APIRouter(prefix="/api", tags=["matches"])

HomeTeam = aliased(Team)
AwayTeam = aliased(Team)


@router.get("/tournaments")
async def list_tournaments(
    db: Annotated[AsyncSession, Depends(get_db)],
):
    stmt = (
        select(
            Tournament,
            func.count(Match.id).label("match_count"),
        )
        .outerjoin(Match, Match.tournament_id == Tournament.id)
        .group_by(Tournament.id)
        .order_by(Tournament.created_at)
    )
    rows = await db.execute(stmt)
    return {
        "data": [
            {
                "id": str(t.id),
                "name": t.name,
                "season": t.season,
                "status": t.status,
                "match_count": count,
            }
            for t, count in rows.all()
        ]
    }


def _match_row_to_dict(match: Match, stage_name: str, home_name: str, away_name: str, result: MatchResult | None, home_code: str | None = None, away_code: str | None = None) -> dict:
    return {
        "id": str(match.id),
        "tournament_id": str(match.tournament_id),
        "home_team": home_name,
        "away_team": away_name,
        "home_team_code": home_code,
        "away_team_code": away_code,
        "home_score": result.home_score if result else None,
        "away_score": result.away_score if result else None,
        "kick_off": match.kickoff_utc.isoformat(),
        "lock_at": match.lock_at.isoformat(),
        "status": match.status,
        "stage_name": stage_name,
        "venue": match.venue,
        "notes": match.notes,
    }


@router.get("/tournaments/{tournament_id}/matches")
async def list_matches(
    tournament_id: str,
    db: Annotated[AsyncSession, Depends(get_db)],
    status: str | None = Query(None, description="Filter by status"),
    stage_id: str | None = Query(None, description="Filter by stage"),
):
    # Verify tournament exists
    t = await db.get(Tournament, tournament_id)
    if not t:
        raise HTTPException(status_code=404, detail="Tournament not found")

    stmt = (
        select(Match, Stage.name, HomeTeam.name, AwayTeam.name, MatchResult, HomeTeam.short_code, AwayTeam.short_code)
        .join(Stage, Match.stage_id == Stage.id)
        .join(HomeTeam, Match.home_team_id == HomeTeam.id)
        .join(AwayTeam, Match.away_team_id == AwayTeam.id)
        .outerjoin(MatchResult, MatchResult.match_id == Match.id)
        .where(Match.tournament_id == tournament_id)
        .order_by(Match.kickoff_utc)
    )

    if status:
        stmt = stmt.where(Match.status == status)
    if stage_id:
        stmt = stmt.where(Match.stage_id == stage_id)

    rows = await db.execute(stmt)
    data = [
        _match_row_to_dict(match, stage_name, home_name, away_name, result, home_code, away_code)
        for match, stage_name, home_name, away_name, result, home_code, away_code in rows.all()
    ]
    return {"data": data}


@router.get("/tournaments/{tournament_id}/stages")
async def list_tournament_stages(
    tournament_id: str,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """List stages for a tournament."""
    t = await db.get(Tournament, tournament_id)
    if not t:
        raise HTTPException(status_code=404, detail="Tournament not found")

    result = await db.execute(
        select(Stage)
        .where(Stage.tournament_id == tournament_id)
        .order_by(Stage.order_index)
    )
    stages = list(result.scalars().all())
    return {
        "data": [
            {
                "id": str(s.id),
                "name": s.name,
                "order_index": s.order_index,
                "is_frozen": s.is_frozen,
                "frozen_at": s.frozen_at.isoformat() if s.frozen_at else None,
                "tournament_id": str(s.tournament_id),
            }
            for s in stages
        ]
    }


@router.get("/matches")
async def list_all_matches(
    db: Annotated[AsyncSession, Depends(get_db)],
    status: str | None = Query(None),
    limit: int = Query(50, ge=1, le=200),
):
    """List matches across all tournaments, optionally filtered by status."""
    stmt = (
        select(Match, Stage.name, HomeTeam.name, AwayTeam.name, MatchResult, HomeTeam.short_code, AwayTeam.short_code)
        .join(Stage, Match.stage_id == Stage.id)
        .join(HomeTeam, Match.home_team_id == HomeTeam.id)
        .join(AwayTeam, Match.away_team_id == AwayTeam.id)
        .outerjoin(MatchResult, MatchResult.match_id == Match.id)
        .order_by(Match.kickoff_utc)
        .limit(limit)
    )
    if status:
        stmt = stmt.where(Match.status == status)
    rows = (await db.execute(stmt)).all()
    return {
        "data": [
            _match_row_to_dict(m, sn, hn, an, r, hc, ac)
            for m, sn, hn, an, r, hc, ac in rows
        ]
    }


@router.get("/matches/{match_id}")
async def get_match(
    match_id: str,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    stmt = (
        select(Match, Stage.name, HomeTeam.name, AwayTeam.name, MatchResult, HomeTeam.short_code, AwayTeam.short_code)
        .join(Stage, Match.stage_id == Stage.id)
        .join(HomeTeam, Match.home_team_id == HomeTeam.id)
        .join(AwayTeam, Match.away_team_id == AwayTeam.id)
        .outerjoin(MatchResult, MatchResult.match_id == Match.id)
        .where(Match.id == match_id)
    )
    row = (await db.execute(stmt)).first()
    if not row:
        raise HTTPException(status_code=404, detail="Match not found")

    match, stage_name, home_name, away_name, result, home_code, away_code = row
    return _match_row_to_dict(match, stage_name, home_name, away_name, result, home_code, away_code)


@router.get("/tournaments/{tournament_id}/team-stats")
async def get_tournament_team_stats(
    tournament_id: str,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    t = await db.get(Tournament, tournament_id)
    if not t:
        raise HTTPException(status_code=404, detail="Tournament not found")

    from app.services.team_stats import get_team_stats

    stats = await get_team_stats(tournament_id, db)
    return {"data": stats}


@router.post("/matches/{match_id}/send-calendar")
async def send_match_calendar(
    match_id: str,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    stmt = (
        select(Match, Stage.name, HomeTeam.name, AwayTeam.name)
        .join(Stage, Match.stage_id == Stage.id)
        .join(HomeTeam, Match.home_team_id == HomeTeam.id)
        .join(AwayTeam, Match.away_team_id == AwayTeam.id)
        .where(Match.id == match_id)
    )
    row = (await db.execute(stmt)).first()
    if not row:
        raise HTTPException(status_code=404, detail="Match not found")

    match, stage_name, home_name, away_name = row
    kickoff = match.kickoff_utc
    end_time = kickoff + timedelta(hours=2)
    lock_time = match.lock_at
    fmt = "%Y%m%dT%H%M%SZ"

    ics_content = (
        "BEGIN:VCALENDAR\r\n"
        "VERSION:2.0\r\n"
        "PRODID:-//REDZONE//Match Calendar//EN\r\n"
        "METHOD:PUBLISH\r\n"
        "BEGIN:VEVENT\r\n"
        f"UID:{match_id}@redzone-soccer.com\r\n"
        f"DTSTART:{kickoff.strftime(fmt)}\r\n"
        f"DTEND:{end_time.strftime(fmt)}\r\n"
        f"SUMMARY:{home_name} vs {away_name}\r\n"
        f"DESCRIPTION:{stage_name} - FIFA World Cup 2026\\n"
        f"Predictions close: {lock_time.strftime('%Y-%m-%d %H:%M UTC')}\\n"
        f"Predict at https://redzone-soccer.com/matches/{match_id}\r\n"
        f"LOCATION:{match.venue or 'TBD'}\r\n"
        "STATUS:CONFIRMED\r\n"
        "BEGIN:VALARM\r\n"
        "TRIGGER:-PT30M\r\n"
        f"DESCRIPTION:Predictions close soon for {home_name} vs {away_name}!\r\n"
        "ACTION:DISPLAY\r\n"
        "END:VALARM\r\n"
        "END:VEVENT\r\n"
        "END:VCALENDAR\r\n"
    )

    email_body = (
        f"Match Reminder: {home_name} vs {away_name}\n\n"
        f"Stage: {stage_name}\n"
        f"Kickoff: {kickoff.strftime('%B %d, %Y at %H:%M UTC')}\n"
        f"Venue: {match.venue or 'TBD'}\n\n"
        f"Predictions close: {lock_time.strftime('%B %d, %Y at %H:%M UTC')}\n\n"
        f"Submit your prediction: https://redzone-soccer.com/matches/{match_id}\n\n"
        "Open the attached .ics file to add this match to your calendar.\n\n"
        "— REDZONE"
    )

    filename = f"{home_name.replace(' ', '_')}_vs_{away_name.replace(' ', '_')}.ics"

    try:
        send_email(
            to=current_user.email,
            subject=f"{home_name} vs {away_name} — Match Reminder",
            body=email_body,
            attachment=(filename, ics_content, "calendar"),
        )
    except Exception:
        raise HTTPException(
            status_code=500,
            detail="Failed to send email. Please try again later.",
        )

    return {"message": f"Calendar event sent to {current_user.email}"}


@router.get("/matches/{match_id}/community-odds")
async def get_match_community_odds(
    match_id: str,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Aggregated community prediction stats for a single match.

    Gated by the `community_odds_enabled` app setting and a minimum
    prediction-count threshold so that early/sparse data cannot bias users.
    Individual predictions are never returned — only aggregates.
    """
    match = await db.get(Match, match_id)
    if not match:
        raise HTTPException(status_code=404, detail="Match not found")

    # Feature toggle
    toggle_row = (await db.execute(
        select(AppSetting.value).where(AppSetting.key == "community_odds_enabled")
    )).scalar_one_or_none()
    enabled = toggle_row == "true"

    # Always compute total so admins/UI can show the threshold message
    total = (await db.execute(
        select(func.count(Prediction.id)).where(Prediction.match_id == match_id)
    )).scalar() or 0

    if not enabled:
        return {
            "enabled": False,
            "available": False,
            "reason": "disabled",
            "total_predictions": total,
            "threshold": COMMUNITY_ODDS_MIN_PREDICTIONS,
        }

    if total < COMMUNITY_ODDS_MIN_PREDICTIONS:
        return {
            "enabled": True,
            "available": False,
            "reason": "below_threshold",
            "total_predictions": total,
            "threshold": COMMUNITY_ODDS_MIN_PREDICTIONS,
        }

    # Outcome distribution (home win / draw / away win)
    outcome_rows = (await db.execute(
        select(
            func.sum(case(
                (Prediction.home_score > Prediction.away_score, 1), else_=0
            )).label("home_win"),
            func.sum(case(
                (Prediction.home_score == Prediction.away_score, 1), else_=0
            )).label("draw"),
            func.sum(case(
                (Prediction.home_score < Prediction.away_score, 1), else_=0
            )).label("away_win"),
            func.avg(Prediction.home_score).label("avg_home"),
            func.avg(Prediction.away_score).label("avg_away"),
        ).where(Prediction.match_id == match_id)
    )).first()

    home_win = int(outcome_rows.home_win or 0)
    draw = int(outcome_rows.draw or 0)
    away_win = int(outcome_rows.away_win or 0)
    avg_home = round(float(outcome_rows.avg_home or 0), 2)
    avg_away = round(float(outcome_rows.avg_away or 0), 2)

    def pct(n: int) -> float:
        return round(n / total * 100, 1) if total else 0.0

    # Top 5 most-predicted exact scores
    top_score_rows = (await db.execute(
        select(
            Prediction.home_score,
            Prediction.away_score,
            func.count(Prediction.id).label("cnt"),
        )
        .where(Prediction.match_id == match_id)
        .group_by(Prediction.home_score, Prediction.away_score)
        .order_by(func.count(Prediction.id).desc())
        .limit(5)
    )).all()

    top_scores = [
        {
            "home_score": int(r.home_score),
            "away_score": int(r.away_score),
            "count": int(r.cnt),
            "percentage": pct(int(r.cnt)),
        }
        for r in top_score_rows
    ]

    return {
        "enabled": True,
        "available": True,
        "total_predictions": total,
        "threshold": COMMUNITY_ODDS_MIN_PREDICTIONS,
        "outcomes": {
            "home_win": {"count": home_win, "percentage": pct(home_win)},
            "draw": {"count": draw, "percentage": pct(draw)},
            "away_win": {"count": away_win, "percentage": pct(away_win)},
        },
        "averages": {
            "home_score": avg_home,
            "away_score": avg_away,
        },
        "top_scores": top_scores,
    }


@router.get("/tournaments/{tournament_id}/community-odds")
async def get_tournament_community_odds(
    tournament_id: str,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Aggregated outcome odds for every match in a tournament.

    Returns a compact map keyed by match_id. Below-threshold matches are
    included with `available: false` so the UI can decide whether to render
    a teaser. Disabled toggle → returns enabled:false with empty map.
    """
    t = await db.get(Tournament, tournament_id)
    if not t:
        raise HTTPException(status_code=404, detail="Tournament not found")

    toggle_row = (await db.execute(
        select(AppSetting.value).where(AppSetting.key == "community_odds_enabled")
    )).scalar_one_or_none()
    enabled = toggle_row == "true"

    if not enabled:
        return {
            "enabled": False,
            "threshold": COMMUNITY_ODDS_MIN_PREDICTIONS,
            "data": {},
        }

    rows = (await db.execute(
        select(
            Match.id,
            func.count(Prediction.id).label("total"),
            func.sum(case(
                (Prediction.home_score > Prediction.away_score, 1), else_=0
            )).label("home_win"),
            func.sum(case(
                (Prediction.home_score == Prediction.away_score, 1), else_=0
            )).label("draw"),
            func.sum(case(
                (Prediction.home_score < Prediction.away_score, 1), else_=0
            )).label("away_win"),
        )
        .outerjoin(Prediction, Prediction.match_id == Match.id)
        .where(Match.tournament_id == tournament_id)
        .group_by(Match.id)
    )).all()

    data: dict[str, dict] = {}
    for r in rows:
        total = int(r.total or 0)
        if total < COMMUNITY_ODDS_MIN_PREDICTIONS:
            data[str(r.id)] = {
                "available": False,
                "total_predictions": total,
            }
            continue
        hw = int(r.home_win or 0)
        dr = int(r.draw or 0)
        aw = int(r.away_win or 0)
        data[str(r.id)] = {
            "available": True,
            "total_predictions": total,
            "home_win_pct": round(hw / total * 100, 1),
            "draw_pct": round(dr / total * 100, 1),
            "away_win_pct": round(aw / total * 100, 1),
        }

    return {
        "enabled": True,
        "threshold": COMMUNITY_ODDS_MIN_PREDICTIONS,
        "data": data,
    }
