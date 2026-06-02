"""Team stats service — fetches from football-data.org with Redis cache, falls back to local DB."""

import json
import logging
from typing import Any

import httpx
from redis import Redis
from sqlalchemy import case, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.db.models import Match, MatchResult, Team

logger = logging.getLogger(__name__)

CACHE_KEY_PREFIX = "team_stats"
CACHE_TTL = 3600  # 1 hour

# FIFA ranking data for known national teams (updated periodically)
FIFA_RANKINGS: dict[str, int] = {
    "Argentina": 1,
    "France": 2,
    "Brazil": 3,
    "England": 4,
    "Belgium": 5,
    "Spain": 6,
    "Netherlands": 7,
    "Portugal": 8,
    "Germany": 9,
    "Italy": 10,
    "Croatia": 11,
    "Uruguay": 12,
    "Colombia": 13,
    "Mexico": 14,
    "USA": 15,
    "Japan": 16,
    "Morocco": 17,
    "Switzerland": 18,
    "Senegal": 19,
    "Denmark": 20,
}


def _get_redis() -> Redis | None:
    try:
        r = Redis.from_url(settings.REDIS_URL, socket_connect_timeout=2, decode_responses=True)
        r.ping()
        return r
    except Exception:
        return None


async def _fetch_from_football_data() -> dict[str, Any] | None:
    """Fetch standings from football-data.org for the World Cup."""
    if not settings.SOCCER_API_KEY:
        return None
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(
                "https://api.football-data.org/v4/competitions/WC/standings",
                headers={"X-Auth-Token": settings.SOCCER_API_KEY},
            )
            if resp.status_code != 200:
                logger.warning("football-data.org returned %s", resp.status_code)
                return None
            data = resp.json()
            # Parse standings into per-team stats
            team_stats: dict[str, Any] = {}
            for standing in data.get("standings", []):
                if standing.get("type") != "TOTAL":
                    continue
                for entry in standing.get("table", []):
                    team_name = entry.get("team", {}).get("name", "")
                    team_stats[team_name] = {
                        "played": entry.get("playedGames", 0),
                        "won": entry.get("won", 0),
                        "drawn": entry.get("draw", 0),
                        "lost": entry.get("lost", 0),
                        "goals_for": entry.get("goalsFor", 0),
                        "goals_against": entry.get("goalsAgainst", 0),
                        "goal_diff": entry.get("goalDifference", 0),
                        "points": entry.get("points", 0),
                        "group": standing.get("group"),
                        "position": entry.get("position"),
                        "crest": entry.get("team", {}).get("crest"),
                    }
            return team_stats
    except Exception as e:
        logger.warning("Failed to fetch from football-data.org: %s", e)
        return None


async def _compute_from_db(tournament_id: str, db: AsyncSession) -> dict[str, Any]:
    """Compute team stats from our own confirmed match results."""
    # Get all confirmed/finished matches with results for this tournament
    stmt = (
        select(
            Match.home_team_id,
            Match.away_team_id,
            MatchResult.home_score,
            MatchResult.away_score,
        )
        .join(MatchResult, MatchResult.match_id == Match.id)
        .where(
            Match.tournament_id == tournament_id,
            Match.status.in_(["confirmed", "finished"]),
        )
    )
    rows = await db.execute(stmt)
    matches = rows.all()

    # Build per-team stats
    stats: dict[str, dict[str, int]] = {}

    def ensure(tid: str) -> dict[str, int]:
        if tid not in stats:
            stats[tid] = {"played": 0, "won": 0, "drawn": 0, "lost": 0, "goals_for": 0, "goals_against": 0}
        return stats[tid]

    for home_id, away_id, h_score, a_score in matches:
        h = ensure(str(home_id))
        a = ensure(str(away_id))
        h["played"] += 1
        a["played"] += 1
        h["goals_for"] += h_score
        h["goals_against"] += a_score
        a["goals_for"] += a_score
        a["goals_against"] += h_score
        if h_score > a_score:
            h["won"] += 1
            a["lost"] += 1
        elif h_score < a_score:
            a["won"] += 1
            h["lost"] += 1
        else:
            h["drawn"] += 1
            a["drawn"] += 1

    # Resolve team names
    team_ids = list(stats.keys())
    if not team_ids:
        # No confirmed matches yet — return all teams with zero stats
        teams_result = await db.execute(
            select(Team).join(Match, (Match.home_team_id == Team.id) | (Match.away_team_id == Team.id))
            .where(Match.tournament_id == tournament_id)
            .distinct()
        )
        all_teams = teams_result.scalars().all()
        return {
            t.name: {
                "played": 0, "won": 0, "drawn": 0, "lost": 0,
                "goals_for": 0, "goals_against": 0, "goal_diff": 0,
                "points": 0, "fifa_ranking": FIFA_RANKINGS.get(t.name),
            }
            for t in all_teams
        }

    teams_result = await db.execute(select(Team).where(Team.id.in_(team_ids)))
    teams_by_id = {str(t.id): t for t in teams_result.scalars().all()}

    # Also get all teams in the tournament for those without results
    all_teams_result = await db.execute(
        select(Team).join(Match, (Match.home_team_id == Team.id) | (Match.away_team_id == Team.id))
        .where(Match.tournament_id == tournament_id)
        .distinct()
    )
    for t in all_teams_result.scalars().all():
        tid = str(t.id)
        if tid not in stats:
            stats[tid] = {"played": 0, "won": 0, "drawn": 0, "lost": 0, "goals_for": 0, "goals_against": 0}
            teams_by_id[tid] = t

    result: dict[str, Any] = {}
    for tid, s in stats.items():
        team = teams_by_id.get(tid)
        if not team:
            continue
        gd = s["goals_for"] - s["goals_against"]
        pts = s["won"] * 3 + s["drawn"]
        result[team.name] = {
            **s,
            "goal_diff": gd,
            "points": pts,
            "fifa_ranking": FIFA_RANKINGS.get(team.name),
        }
    return result


async def get_team_stats(tournament_id: str, db: AsyncSession) -> dict[str, Any]:
    """Get team stats with Redis cache → football-data.org → local DB fallback."""
    cache_key = f"{CACHE_KEY_PREFIX}:{tournament_id}"

    # 1. Check Redis cache
    r = _get_redis()
    if r:
        try:
            cached = r.get(cache_key)
            if cached:
                return json.loads(cached)
        except Exception:
            pass

    # 2. Try football-data.org
    api_stats = await _fetch_from_football_data()
    if api_stats:
        # Enrich with FIFA rankings
        for name, s in api_stats.items():
            s["fifa_ranking"] = FIFA_RANKINGS.get(name)
        # Cache
        if r:
            try:
                r.set(cache_key, json.dumps(api_stats), ex=CACHE_TTL)
            except Exception:
                pass
        return api_stats

    # 3. Fall back to local DB
    db_stats = await _compute_from_db(tournament_id, db)
    if r and db_stats:
        try:
            r.set(cache_key, json.dumps(db_stats), ex=CACHE_TTL)
        except Exception:
            pass
    return db_stats
