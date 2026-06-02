from datetime import datetime, timezone
from typing import Annotated
from uuid import UUID
import csv
import io

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import aliased

from app.core.dependencies import require_admin
from app.db.models import AuditLog, DuelChallenge, Match, MatchResult, Prediction, Stage, Team, Tournament, User, UserProfile
from app.db.session import get_db

router = APIRouter(prefix="/api/admin", tags=["admin-matches"])

HomeTeam = aliased(Team)
AwayTeam = aliased(Team)


class ResultOverride(BaseModel):
    home_score: int
    away_score: int


class CreateMatch(BaseModel):
    tournament_id: UUID
    stage_id: UUID
    home_team_id: UUID
    away_team_id: UUID
    kickoff_utc: str  # ISO 8601
    venue: str | None = None


class ImportMatchSelection(BaseModel):
    """Which fetched matches to import."""
    tournament_id: UUID
    stage_id: UUID
    matches: list[dict]  # Each: {home_team, away_team, kickoff_utc, venue?, external_id?}


# ── Helper: list tournaments, stages, teams for dropdowns ────────────────────

@router.get("/dropdown-data")
async def dropdown_data(
    db: Annotated[AsyncSession, Depends(get_db)],
    admin: Annotated[User, Depends(require_admin)],
):
    """Return tournaments, stages, teams for admin forms."""
    tournaments = (await db.execute(
        select(Tournament.id, Tournament.name).order_by(Tournament.name)
    )).all()
    stages = (await db.execute(
        select(Stage.id, Stage.name, Stage.tournament_id).order_by(Stage.order_index)
    )).all()
    teams = (await db.execute(
        select(Team.id, Team.name, Team.short_code).order_by(Team.name)
    )).all()

    # Build team→tournament mapping from existing matches
    team_tournaments_q = await db.execute(
        select(Match.home_team_id, Match.tournament_id).distinct()
        .union(select(Match.away_team_id, Match.tournament_id).distinct())
    )
    team_tournament_map: dict[str, set[str]] = {}
    for team_id, tournament_id in team_tournaments_q.all():
        key = str(team_id)
        if key not in team_tournament_map:
            team_tournament_map[key] = set()
        team_tournament_map[key].add(str(tournament_id))

    # Matches for challenge creation (with team names)
    matches_q = (
        await db.execute(
            select(Match.id, Match.kickoff_utc, Match.tournament_id, Match.stage_id, HomeTeam.name, AwayTeam.name)
            .join(HomeTeam, HomeTeam.id == Match.home_team_id)
            .join(AwayTeam, AwayTeam.id == Match.away_team_id)
            .order_by(Match.kickoff_utc)
        )
    ).all()

    return {
        "tournaments": [{"id": str(t.id), "name": t.name} for t in tournaments],
        "stages": [{"id": str(s.id), "name": s.name, "tournament_id": str(s.tournament_id)} for s in stages],
        "teams": [{"id": str(t.id), "name": t.name, "short_code": t.short_code, "tournament_ids": list(team_tournament_map.get(str(t.id), []))} for t in teams],
        "matches": [
            {
                "id": str(m.id),
                "label": f"{m[4]} vs {m[5]}",
                "kickoff_utc": m.kickoff_utc.isoformat() if m.kickoff_utc else None,
                "tournament_id": str(m.tournament_id),
                "stage_id": str(m.stage_id),
            }
            for m in matches_q
        ],
    }


# ── List matches ─────────────────────────────────────────────────────────────

@router.get("/matches")
async def list_admin_matches(
    db: Annotated[AsyncSession, Depends(get_db)],
    admin: Annotated[User, Depends(require_admin)],
    tournament_id: UUID | None = Query(None),
    match_status: str | None = Query(None, alias="status"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
):
    """List matches for admin management."""
    query = (
        select(
            Match,
            HomeTeam.name,
            AwayTeam.name,
            Stage.name,
            MatchResult,
        )
        .join(HomeTeam, HomeTeam.id == Match.home_team_id)
        .join(AwayTeam, AwayTeam.id == Match.away_team_id)
        .join(Stage, Stage.id == Match.stage_id)
        .outerjoin(MatchResult, MatchResult.match_id == Match.id)
        .order_by(Match.kickoff_utc.desc())
    )
    if tournament_id:
        query = query.where(Match.tournament_id == tournament_id)
    if match_status:
        query = query.where(Match.status == match_status)

    query = query.offset(offset).limit(limit)
    result = await db.execute(query)
    rows = result.all()

    data = []
    for m, home_name, away_name, stage_name, mr in rows:
        data.append({
            "id": str(m.id),
            "tournament_id": str(m.tournament_id),
            "stage_id": str(m.stage_id),
            "home_team_id": str(m.home_team_id),
            "away_team_id": str(m.away_team_id),
            "home_team": home_name,
            "away_team": away_name,
            "stage_name": stage_name,
            "kickoff_utc": m.kickoff_utc.isoformat(),
            "venue": m.venue or "",
            "notes": m.notes or "",
            "status": m.status,
            "home_score": mr.home_score if mr else None,
            "away_score": mr.away_score if mr else None,
            "is_override": mr.is_override if mr else False,
        })
    return {"data": data}


# ── Create match manually ────────────────────────────────────────────────────

@router.post("/matches", status_code=201)
async def create_match(
    body: CreateMatch,
    db: Annotated[AsyncSession, Depends(get_db)],
    admin: Annotated[User, Depends(require_admin)],
):
    """Create a match manually."""
    # Validate FK references
    t = (await db.execute(select(Tournament).where(Tournament.id == body.tournament_id))).scalar_one_or_none()
    if not t:
        raise HTTPException(status_code=400, detail="Tournament not found")
    s = (await db.execute(select(Stage).where(Stage.id == body.stage_id))).scalar_one_or_none()
    if not s:
        raise HTTPException(status_code=400, detail="Stage not found")
    ht = (await db.execute(select(Team).where(Team.id == body.home_team_id))).scalar_one_or_none()
    at_ = (await db.execute(select(Team).where(Team.id == body.away_team_id))).scalar_one_or_none()
    if not ht or not at_:
        raise HTTPException(status_code=400, detail="Team not found")
    if body.home_team_id == body.away_team_id:
        raise HTTPException(status_code=400, detail="Home and away teams must be different")

    kickoff = datetime.fromisoformat(body.kickoff_utc)
    match = Match(
        tournament_id=body.tournament_id,
        stage_id=body.stage_id,
        home_team_id=body.home_team_id,
        away_team_id=body.away_team_id,
        kickoff_utc=kickoff,
        lock_at=kickoff,  # Lock at kickoff by default
        venue=body.venue,
    )
    db.add(match)
    await db.flush()

    audit = AuditLog(
        actor_id=admin.id,
        action="create_match",
        resource_type="match",
        resource_id=match.id,
        after_state={"home": ht.name, "away": at_.name, "kickoff": body.kickoff_utc},
    )
    db.add(audit)
    await db.commit()

    return {"id": str(match.id), "message": "Match created"}


# ── Sync from external API (preview) ────────────────────────────────────────

@router.get("/sync/preview")
async def sync_preview(
    competition_id: str = Query(...),
    admin: User = Depends(require_admin),
):
    """Fetch matches from football-data.org and return them for selection."""
    from app.services.soccer_api.football_data import FootballDataProvider

    provider = FootballDataProvider()
    try:
        raw_matches = await provider.fetch_matches(competition_id)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"API error: {str(e)}")

    # Map to a simplified format
    preview = []
    for m in raw_matches:
        home = m.get("homeTeam", {})
        away = m.get("awayTeam", {})
        preview.append({
            "external_id": str(m.get("id", "")),
            "home_team": home.get("name", "TBD"),
            "home_tla": home.get("tla", ""),
            "away_team": away.get("name", "TBD"),
            "away_tla": away.get("tla", ""),
            "kickoff_utc": m.get("utcDate", ""),
            "status": m.get("status", ""),
            "stage": m.get("stage", ""),
            "group": m.get("group"),
            "matchday": m.get("matchday"),
        })
    return {"data": preview, "total": len(preview)}


@router.post("/sync/import")
async def sync_import(
    body: ImportMatchSelection,
    db: Annotated[AsyncSession, Depends(get_db)],
    admin: Annotated[User, Depends(require_admin)],
):
    """Import selected synced matches into the database."""
    # Validate tournament and stage
    t = (await db.execute(select(Tournament).where(Tournament.id == body.tournament_id))).scalar_one_or_none()
    if not t:
        raise HTTPException(status_code=400, detail="Tournament not found")
    s = (await db.execute(select(Stage).where(Stage.id == body.stage_id))).scalar_one_or_none()
    if not s:
        raise HTTPException(status_code=400, detail="Stage not found")

    # Build team lookup by short_code / name
    teams_result = await db.execute(select(Team))
    all_teams = list(teams_result.scalars().all())
    team_by_code = {t.short_code.upper(): t for t in all_teams if t.short_code}
    team_by_name = {t.name.lower(): t for t in all_teams}

    def find_team(name: str | None, tla: str | None) -> Team | None:
        if tla and tla.upper() in team_by_code:
            return team_by_code[tla.upper()]
        if name and name.lower() in team_by_name:
            return team_by_name[name.lower()]
        return None

    created = 0
    skipped = []
    for m in body.matches:
        ht = find_team(m.get("home_team", ""), m.get("home_tla", ""))
        at_ = find_team(m.get("away_team", ""), m.get("away_tla", ""))
        if not ht or not at_:
            skipped.append(f"{m.get('home_team', '?')} vs {m.get('away_team', '?')} (team not found)")
            continue

        # Skip if already imported (by external_id)
        ext_id = m.get("external_id")
        if ext_id:
            existing = (await db.execute(
                select(Match).where(Match.external_id == ext_id)
            )).scalar_one_or_none()
            if existing:
                skipped.append(f"{m.get('home_team', '?')} vs {m.get('away_team', '?')} (already exists)")
                continue

        kickoff = datetime.fromisoformat(m["kickoff_utc"].replace("Z", "+00:00"))
        match = Match(
            tournament_id=body.tournament_id,
            stage_id=body.stage_id,
            home_team_id=ht.id,
            away_team_id=at_.id,
            kickoff_utc=kickoff,
            lock_at=kickoff,
            venue=m.get("venue"),
            external_id=ext_id,
        )
        db.add(match)
        created += 1

    if created:
        audit = AuditLog(
            actor_id=admin.id,
            action="import_matches",
            resource_type="match",
            after_state={"count": created, "tournament": str(body.tournament_id)},
        )
        db.add(audit)
        await db.commit()

    return {"created": created, "skipped": skipped}


# ── Result override ──────────────────────────────────────────────────────────

@router.put("/matches/{match_id}/result")
async def override_result(
    match_id: UUID,
    body: ResultOverride,
    db: Annotated[AsyncSession, Depends(get_db)],
    admin: Annotated[User, Depends(require_admin)],
):
    """Set or override a match result."""
    result = await db.execute(select(Match).where(Match.id == match_id))
    match = result.scalar_one_or_none()
    if not match:
        raise HTTPException(status_code=404, detail="Match not found")

    match.status = "confirmed"

    mr_result = await db.execute(
        select(MatchResult).where(MatchResult.match_id == match_id)
    )
    mr = mr_result.scalar_one_or_none()
    before = None
    if mr:
        before = {"home_score": mr.home_score, "away_score": mr.away_score}
        mr.home_score = body.home_score
        mr.away_score = body.away_score
        mr.is_override = True
        mr.confirmed_by = admin.id
        mr.confirmed_at = datetime.now(timezone.utc)
    else:
        mr = MatchResult(
            match_id=match_id,
            home_score=body.home_score,
            away_score=body.away_score,
            is_override=True,
            confirmed_by=admin.id,
        )
        db.add(mr)

    audit = AuditLog(
        actor_id=admin.id,
        action="override_result",
        resource_type="match",
        resource_id=match_id,
        before_state=before,
        after_state={"home_score": body.home_score, "away_score": body.away_score},
    )
    db.add(audit)
    await db.commit()

    # Trigger scoring pipeline
    try:
        from app.jobs.process_results import _process
        scoring_summary = await _process(str(match_id))
    except Exception as e:
        import logging
        logging.getLogger(__name__).error("Scoring failed for match %s: %s", match_id, e)
        scoring_summary = {"error": str(e)}

    return {"message": "Result set", "home_score": body.home_score, "away_score": body.away_score, "scoring": scoring_summary}


# ── Clear result ─────────────────────────────────────────────────────────────

@router.delete("/matches/{match_id}/result")
async def clear_result(
    match_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    admin: Annotated[User, Depends(require_admin)],
):
    """Remove match result and reset status to scheduled."""
    result = await db.execute(select(Match).where(Match.id == match_id))
    match = result.scalar_one_or_none()
    if not match:
        raise HTTPException(status_code=404, detail="Match not found")

    mr_result = await db.execute(
        select(MatchResult).where(MatchResult.match_id == match_id)
    )
    mr = mr_result.scalar_one_or_none()
    if not mr:
        raise HTTPException(status_code=404, detail="No result to clear")

    before = {"home_score": mr.home_score, "away_score": mr.away_score, "status": match.status}
    await db.delete(mr)
    match.status = "scheduled"

    from sqlalchemy import update as sa_update

    # Clear prediction scores for this match
    preds = (await db.execute(
        select(Prediction).where(Prediction.match_id == match_id)
    )).scalars().all()
    affected_user_ids = set()
    for pred in preds:
        affected_user_ids.add(pred.user_id)
        pred.points = None
        pred.result_type = None

    # Revert completed duels back to active (reverse escrow payouts)
    duels = (await db.execute(
        select(DuelChallenge).where(
            DuelChallenge.match_id == match_id,
            DuelChallenge.status == "completed",
        )
    )).scalars().all()
    for duel in duels:
        affected_user_ids.add(duel.challenger_id)
        affected_user_ids.add(duel.opponent_id)
        stake = duel.stake_points

        # Reverse the payout that happened on resolution
        if duel.winner_id is not None:
            # Winner received 2 × stake; take it back
            await db.execute(
                sa_update(UserProfile)
                .where(UserProfile.user_id == duel.winner_id)
                .values(duel_points_balance=UserProfile.duel_points_balance - 2 * stake)
            )
        else:
            # Tie: both were refunded stake; take it back
            await db.execute(
                sa_update(UserProfile)
                .where(UserProfile.user_id == duel.challenger_id)
                .values(duel_points_balance=UserProfile.duel_points_balance - stake)
            )
            await db.execute(
                sa_update(UserProfile)
                .where(UserProfile.user_id == duel.opponent_id)
                .values(duel_points_balance=UserProfile.duel_points_balance - stake)
            )

        duel.status = "active"
        duel.winner_id = None
        duel.challenger_score = None
        duel.opponent_score = None
        duel.resolved_at = None

    # Recalculate totals for affected users
    for uid in affected_user_ids:
        all_preds = (await db.execute(
            select(Prediction.points, Prediction.result_type)
            .where(Prediction.user_id == uid, Prediction.points.isnot(None))
        )).all()
        total = sum(p.points for p in all_preds)
        exact = sum(1 for p in all_preds if p.result_type == "exact")
        outcome = sum(1 for p in all_preds if p.result_type == "outcome")
        await db.execute(
            sa_update(UserProfile)
            .where(UserProfile.user_id == uid)
            .values(total_points=total, exact_hits=exact, outcome_hits=outcome)
        )
        # Recalculate duel counters
        all_duels = (await db.execute(
            select(DuelChallenge).where(
                DuelChallenge.status == "completed",
                (DuelChallenge.challenger_id == uid) | (DuelChallenge.opponent_id == uid),
            )
        )).scalars().all()
        wins = sum(1 for d in all_duels if d.winner_id == uid)
        losses = sum(1 for d in all_duels if d.winner_id is not None and d.winner_id != uid)
        draws = sum(1 for d in all_duels if d.winner_id is None)
        await db.execute(
            sa_update(UserProfile)
            .where(UserProfile.user_id == uid)
            .values(duel_wins=wins, duel_losses=losses, duel_draws=draws)
        )

    audit = AuditLog(
        actor_id=admin.id,
        action="clear_result",
        resource_type="match",
        resource_id=match_id,
        before_state=before,
        after_state={"status": "scheduled"},
    )
    db.add(audit)
    await db.commit()

    return {"message": "Result cleared"}


# ── UNAFUT sync (on-demand) ───────────────────────────────────────────────────

@router.post("/sync/unafut")
async def sync_unafut(
    admin: Annotated[User, Depends(require_admin)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Scrape UNAFUT calendar and sync matches/results into DB."""
    from app.jobs.sync_unafut import sync_unafut

    try:
        summary = await sync_unafut()
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"UNAFUT sync failed: {str(e)}")

    audit = AuditLog(
        actor_id=admin.id,
        action="sync_unafut",
        resource_type="match",
        after_state=summary,
    )
    db.add(audit)
    await db.commit()

    return summary


# ── Status update ────────────────────────────────────────────────────────────

@router.put("/matches/{match_id}/status")
async def update_match_status(
    match_id: UUID,
    status_val: str = Query(..., alias="status"),
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin),
):
    valid = {"scheduled", "live", "finished", "confirmed", "postponed", "cancelled"}
    if status_val not in valid:
        raise HTTPException(status_code=400, detail=f"Invalid status. Must be one of: {valid}")

    result = await db.execute(select(Match).where(Match.id == match_id))
    match = result.scalar_one_or_none()
    if not match:
        raise HTTPException(status_code=404, detail="Match not found")

    old_status = match.status
    match.status = status_val

    audit = AuditLog(
        actor_id=admin.id,
        action="update_match_status",
        resource_type="match",
        resource_id=match_id,
        before_state={"status": old_status},
        after_state={"status": status_val},
    )
    db.add(audit)
    await db.commit()

    return {"message": f"Match status updated to {status_val}"}


# ── Edit match details ───────────────────────────────────────────────────────

class EditMatch(BaseModel):
    stage_id: UUID | None = None
    home_team_id: UUID | None = None
    away_team_id: UUID | None = None
    kickoff_utc: str | None = None
    venue: str | None = None
    notes: str | None = None
    status: str | None = None


@router.put("/matches/{match_id}")
async def edit_match(
    match_id: UUID,
    body: EditMatch,
    db: Annotated[AsyncSession, Depends(get_db)],
    admin: Annotated[User, Depends(require_admin)],
):
    result = await db.execute(select(Match).where(Match.id == match_id))
    match = result.scalar_one_or_none()
    if not match:
        raise HTTPException(status_code=404, detail="Match not found")

    before: dict = {}
    after: dict = {}

    if body.stage_id is not None and body.stage_id != match.stage_id:
        s = (await db.execute(select(Stage).where(Stage.id == body.stage_id))).scalar_one_or_none()
        if not s:
            raise HTTPException(status_code=400, detail="Stage not found")
        before["stage_id"] = str(match.stage_id)
        match.stage_id = body.stage_id
        after["stage_id"] = str(body.stage_id)

    if body.home_team_id is not None and body.home_team_id != match.home_team_id:
        ht = (await db.execute(select(Team).where(Team.id == body.home_team_id))).scalar_one_or_none()
        if not ht:
            raise HTTPException(status_code=400, detail="Home team not found")
        before["home_team_id"] = str(match.home_team_id)
        match.home_team_id = body.home_team_id
        after["home_team_id"] = str(body.home_team_id)

    if body.away_team_id is not None and body.away_team_id != match.away_team_id:
        at_ = (await db.execute(select(Team).where(Team.id == body.away_team_id))).scalar_one_or_none()
        if not at_:
            raise HTTPException(status_code=400, detail="Away team not found")
        before["away_team_id"] = str(match.away_team_id)
        match.away_team_id = body.away_team_id
        after["away_team_id"] = str(body.away_team_id)

    if body.home_team_id and body.away_team_id and body.home_team_id == body.away_team_id:
        raise HTTPException(status_code=400, detail="Home and away teams must differ")

    if body.kickoff_utc is not None:
        kickoff = datetime.fromisoformat(body.kickoff_utc)
        before["kickoff_utc"] = match.kickoff_utc.isoformat()
        match.kickoff_utc = kickoff
        match.lock_at = kickoff
        after["kickoff_utc"] = kickoff.isoformat()

    if body.venue is not None:
        before["venue"] = match.venue
        match.venue = body.venue or None
        after["venue"] = match.venue

    if body.notes is not None:
        before["notes"] = match.notes
        match.notes = body.notes.strip() or None
        after["notes"] = match.notes

    if body.status is not None:
        valid = {"scheduled", "live", "finished", "confirmed", "postponed", "cancelled"}
        if body.status not in valid:
            raise HTTPException(status_code=400, detail=f"Invalid status")
        before["status"] = match.status
        match.status = body.status
        after["status"] = body.status

    if after:
        audit = AuditLog(
            actor_id=admin.id,
            action="edit_match",
            resource_type="match",
            resource_id=match_id,
            before_state=before,
            after_state=after,
        )
        db.add(audit)
        await db.commit()

    return {"message": "Match updated"}


# ── Delete match ─────────────────────────────────────────────────────────────

@router.delete("/matches/{match_id}")
async def delete_match(
    match_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    admin: Annotated[User, Depends(require_admin)],
):
    result = await db.execute(select(Match).where(Match.id == match_id))
    match = result.scalar_one_or_none()
    if not match:
        raise HTTPException(status_code=404, detail="Match not found")

    # Get team names for audit
    ht = (await db.execute(select(Team.name).where(Team.id == match.home_team_id))).scalar()
    at_ = (await db.execute(select(Team.name).where(Team.id == match.away_team_id))).scalar()

    # Delete match result first if exists
    mr = (await db.execute(select(MatchResult).where(MatchResult.match_id == match_id))).scalar_one_or_none()
    if mr:
        await db.delete(mr)

    # Delete related predictions
    from app.db.models import Prediction
    preds = (await db.execute(select(Prediction).where(Prediction.match_id == match_id))).scalars().all()
    for p in preds:
        await db.delete(p)

    # Delete related comments
    from app.db.models import Comment
    comments = (await db.execute(select(Comment).where(Comment.match_id == match_id))).scalars().all()
    for c in comments:
        await db.delete(c)

    # Delete related duel challenges
    from app.db.models import DuelChallenge
    duels = (await db.execute(select(DuelChallenge).where(DuelChallenge.match_id == match_id))).scalars().all()
    for d in duels:
        await db.delete(d)

    audit = AuditLog(
        actor_id=admin.id,
        action="delete_match",
        resource_type="match",
        resource_id=match_id,
        before_state={"home": ht, "away": at_, "kickoff": match.kickoff_utc.isoformat()},
    )
    db.add(audit)
    await db.delete(match)
    await db.commit()

    return {"message": "Match deleted"}


# ── CSV Export (template with current data) ───────────────────────────────────

@router.get("/csv/export")
async def csv_export(
    tournament_id: UUID = Query(...),
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """Export current matches for a tournament as CSV, ready for score updates."""
    from fastapi.responses import StreamingResponse

    tournament = (await db.execute(
        select(Tournament).where(Tournament.id == tournament_id)
    )).scalar_one_or_none()
    if not tournament:
        raise HTTPException(status_code=404, detail="Tournament not found")

    rows = (await db.execute(
        select(Match, HomeTeam, AwayTeam, Stage.name, MatchResult)
        .join(HomeTeam, HomeTeam.id == Match.home_team_id)
        .join(AwayTeam, AwayTeam.id == Match.away_team_id)
        .join(Stage, Stage.id == Match.stage_id)
        .outerjoin(MatchResult, MatchResult.match_id == Match.id)
        .where(Match.tournament_id == tournament_id)
        .order_by(Match.kickoff_utc)
    )).all()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["home_team", "away_team", "kickoff_utc", "stage", "venue", "home_score", "away_score"])

    for match, ht, at_, stage_name, mr in rows:
        writer.writerow([
            ht.short_code or ht.name,
            at_.short_code or at_.name,
            match.kickoff_utc.isoformat(),
            stage_name,
            match.venue or "",
            mr.home_score if mr else "",
            mr.away_score if mr else "",
        ])

    output.seek(0)
    safe_name = tournament.name.replace(" ", "_").replace("/", "-")
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{safe_name}_matches.csv"'},
    )


# ── CSV Import / Update ──────────────────────────────────────────────────────

CSV_REQUIRED_COLS = {"home_team", "away_team", "kickoff_utc", "stage"}

@router.post("/csv/import")
async def csv_import(
    file: UploadFile = File(...),
    tournament_id: UUID = Query(...),
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """
    Import matches from CSV or update scores for existing matches.

    Required columns: home_team, away_team, kickoff_utc, stage
    Optional columns: venue, home_score, away_score

    Matching: finds existing match by home_team + away_team + tournament.
    If home_score & away_score are present, sets/updates the result.
    If no match exists, creates one.
    Teams are looked up by short_code first, then by name.
    Stages are looked up by name within the tournament; created if missing.
    """
    if not file.filename or not file.filename.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="File must be a .csv")

    raw = await file.read()
    try:
        text = raw.decode("utf-8-sig")  # handles BOM from Excel
    except UnicodeDecodeError:
        raise HTTPException(status_code=400, detail="File must be UTF-8 encoded")

    reader = csv.DictReader(io.StringIO(text))
    if not reader.fieldnames:
        raise HTTPException(status_code=400, detail="CSV has no headers")

    headers = {h.strip().lower() for h in reader.fieldnames}
    missing = CSV_REQUIRED_COLS - headers
    if missing:
        raise HTTPException(status_code=400, detail=f"Missing columns: {', '.join(sorted(missing))}")

    # Validate tournament
    tournament = (await db.execute(
        select(Tournament).where(Tournament.id == tournament_id)
    )).scalar_one_or_none()
    if not tournament:
        raise HTTPException(status_code=400, detail="Tournament not found")

    # Build lookup caches
    teams_result = await db.execute(select(Team))
    all_teams = list(teams_result.scalars().all())
    team_by_code = {t.short_code.upper(): t for t in all_teams if t.short_code}
    team_by_name = {t.name.lower(): t for t in all_teams}

    stages_result = await db.execute(
        select(Stage).where(Stage.tournament_id == tournament_id).order_by(Stage.order_index)
    )
    all_stages = list(stages_result.scalars().all())
    stage_by_name: dict[str, Stage] = {s.name.lower(): s for s in all_stages}
    next_order = max((s.order_index for s in all_stages), default=0) + 1

    # Load existing matches for this tournament
    existing_q = await db.execute(
        select(Match, HomeTeam, AwayTeam)
        .join(HomeTeam, HomeTeam.id == Match.home_team_id)
        .join(AwayTeam, AwayTeam.id == Match.away_team_id)
        .where(Match.tournament_id == tournament_id)
    )
    existing_matches: dict[str, Match] = {}
    for m, ht, at_ in existing_q.all():
        key = f"{ht.short_code or ht.name}|{at_.short_code or at_.name}".lower()
        existing_matches[key] = m

    def find_team(val: str) -> Team | None:
        v = val.strip()
        if v.upper() in team_by_code:
            return team_by_code[v.upper()]
        if v.lower() in team_by_name:
            return team_by_name[v.lower()]
        return None

    def find_or_create_stage(name: str) -> Stage:
        nonlocal next_order
        key = name.strip().lower()
        if key in stage_by_name:
            return stage_by_name[key]
        stage = Stage(
            tournament_id=tournament_id,
            name=name.strip(),
            order_index=next_order,
        )
        next_order += 1
        db.add(stage)
        stage_by_name[key] = stage
        return stage

    created = 0
    updated = 0
    scores_set = 0
    errors: list[str] = []

    for row_num, row in enumerate(reader, start=2):
        # Normalize keys
        row = {k.strip().lower(): v.strip() for k, v in row.items() if k}

        home_val = row.get("home_team", "")
        away_val = row.get("away_team", "")
        stage_val = row.get("stage", "")
        kickoff_val = row.get("kickoff_utc", "")
        venue_val = row.get("venue", "")
        home_score_val = row.get("home_score", "")
        away_score_val = row.get("away_score", "")

        if not home_val or not away_val:
            errors.append(f"Row {row_num}: missing home_team or away_team")
            continue

        ht = find_team(home_val)
        at_ = find_team(away_val)
        if not ht:
            errors.append(f"Row {row_num}: team not found: {home_val}")
            continue
        if not at_:
            errors.append(f"Row {row_num}: team not found: {away_val}")
            continue

        # Check if match already exists
        match_key = f"{ht.short_code or ht.name}|{at_.short_code or at_.name}".lower()
        existing = existing_matches.get(match_key)

        if existing:
            # Update scores if provided
            if home_score_val and away_score_val:
                try:
                    hs = int(home_score_val)
                    as_ = int(away_score_val)
                except ValueError:
                    errors.append(f"Row {row_num}: invalid score values")
                    continue
                if hs < 0 or as_ < 0:
                    errors.append(f"Row {row_num}: scores must be >= 0")
                    continue

                existing.status = "confirmed"
                mr_q = await db.execute(
                    select(MatchResult).where(MatchResult.match_id == existing.id)
                )
                mr = mr_q.scalar_one_or_none()
                if mr:
                    mr.home_score = hs
                    mr.away_score = as_
                    mr.is_override = True
                    mr.confirmed_by = admin.id
                    mr.confirmed_at = datetime.now(timezone.utc)
                else:
                    mr = MatchResult(
                        match_id=existing.id,
                        home_score=hs,
                        away_score=as_,
                        is_override=True,
                        confirmed_by=admin.id,
                    )
                    db.add(mr)
                scores_set += 1
            else:
                updated += 0  # match exists, no score to update
        else:
            # Create new match
            if not kickoff_val:
                errors.append(f"Row {row_num}: kickoff_utc required for new match")
                continue
            try:
                kickoff = datetime.fromisoformat(kickoff_val.replace("Z", "+00:00"))
            except ValueError:
                errors.append(f"Row {row_num}: invalid kickoff_utc format")
                continue

            if not stage_val:
                errors.append(f"Row {row_num}: stage required for new match")
                continue

            stage = find_or_create_stage(stage_val)
            await db.flush()  # ensure stage has an ID

            match = Match(
                tournament_id=tournament_id,
                stage_id=stage.id,
                home_team_id=ht.id,
                away_team_id=at_.id,
                kickoff_utc=kickoff,
                lock_at=kickoff,
                venue=venue_val or None,
            )
            db.add(match)
            await db.flush()
            existing_matches[match_key] = match

            # If scores provided on creation, also add result
            if home_score_val and away_score_val:
                try:
                    hs = int(home_score_val)
                    as_ = int(away_score_val)
                    match.status = "confirmed"
                    mr = MatchResult(
                        match_id=match.id,
                        home_score=hs,
                        away_score=as_,
                        is_override=True,
                        confirmed_by=admin.id,
                    )
                    db.add(mr)
                    scores_set += 1
                except ValueError:
                    pass

            created += 1

    if created or scores_set:
        audit = AuditLog(
            actor_id=admin.id,
            action="csv_import",
            resource_type="match",
            after_state={
                "tournament_id": str(tournament_id),
                "created": created,
                "scores_set": scores_set,
                "errors": len(errors),
            },
        )
        db.add(audit)

    await db.commit()

    return {
        "created": created,
        "scores_set": scores_set,
        "errors": errors,
    }
