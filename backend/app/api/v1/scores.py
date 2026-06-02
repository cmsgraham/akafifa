"""Live scores from ESPN's public scoreboard API, cached in Redis.

Fetches today + the previous 2 days so the ticker always has a mix of
live games, upcoming fixtures, and recent results.
"""

import asyncio
import json as _json
import logging
from datetime import datetime, timedelta, timezone

import httpx
from fastapi import APIRouter
from redis import Redis

from app.core.config import settings

logger = logging.getLogger("uvicorn.error")
router = APIRouter(prefix="/api/scores", tags=["scores"])

CACHE_KEY = "scores:live"
CACHE_TTL = 120  # 2 minutes

# How many previous days of results to include
LOOKBACK_DAYS = 2

# Major leagues to aggregate
LEAGUES = [
    ("eng.1", "Premier League"),
    ("esp.1", "La Liga"),
    ("ger.1", "Bundesliga"),
    ("ita.1", "Serie A"),
    ("fra.1", "Ligue 1"),
    ("usa.1", "MLS"),
    ("uefa.champions", "Champions League"),
    ("uefa.europa", "Europa League"),
    ("fifa.world", "World Cup"),
    ("fifa.friendly", "Int'l Friendly"),
    ("conmebol.libertadores", "Libertadores"),
    ("mex.1", "Liga MX"),
]

# Cap total items so the ticker stays readable
MAX_TICKER_ITEMS = 30


def _get_redis() -> Redis:
    return Redis.from_url(settings.REDIS_URL, decode_responses=True)


def _parse_event(event: dict, league_name: str) -> dict | None:
    """Extract a ticker-friendly dict from an ESPN event."""
    comp = event["competitions"][0]
    teams = comp["competitors"]
    home = next((t for t in teams if t["homeAway"] == "home"), None)
    away = next((t for t in teams if t["homeAway"] == "away"), None)
    if not home or not away:
        return None

    status_obj = comp["status"]["type"]
    state = status_obj.get("state", "")  # pre, in, post
    detail = comp["status"].get("displayClock", "")
    status_desc = status_obj.get("shortDetail", status_obj.get("description", ""))

    return {
        "league": league_name,
        "home": home["team"].get("shortDisplayName", home["team"].get("name", "?")),
        "away": away["team"].get("shortDisplayName", away["team"].get("name", "?")),
        "home_score": home.get("score", "-"),
        "away_score": away.get("score", "-"),
        "state": state,
        "detail": status_desc,
        "clock": detail,
    }


async def _fetch_scores() -> list[dict]:
    """Fetch scores for today + previous days across major leagues."""
    today = datetime.now(timezone.utc).date()
    dates = [today - timedelta(days=d) for d in range(LOOKBACK_DAYS + 1)]
    date_strs = [d.strftime("%Y%m%d") for d in dates]

    live_games: list[dict] = []
    upcoming_games: list[dict] = []
    recent_results: list[dict] = []

    async def _fetch_league_date(
        client: httpx.AsyncClient, code: str, league_name: str, ds: str
    ) -> list[tuple[str, dict]]:
        """Fetch one league/date and return (state, item) tuples."""
        items: list[tuple[str, dict]] = []
        try:
            resp = await client.get(
                f"http://site.api.espn.com/apis/site/v2/sports/soccer/{code}/scoreboard",
                params={"dates": ds},
            )
            if resp.status_code != 200:
                return items
            data = resp.json()
            for event in data.get("events", []):
                item = _parse_event(event, league_name)
                if item:
                    items.append((item["state"], item))
        except Exception as exc:
            logger.warning("ESPN fetch error %s/%s: %s", code, ds, exc)
        return items

    async with httpx.AsyncClient(timeout=6, follow_redirects=True) as client:
        tasks = [
            _fetch_league_date(client, code, league_name, ds)
            for code, league_name in LEAGUES
            for ds in date_strs
        ]
        results = await asyncio.gather(*tasks)
        for pairs in results:
            for state, item in pairs:
                if state == "in":
                    live_games.append(item)
                elif state == "pre":
                    upcoming_games.append(item)
                else:
                    recent_results.append(item)

    # Build a balanced ticker: all live, then interleave upcoming + results
    ticker: list[dict] = list(live_games)

    # Alternate upcoming ↔ results for variety
    u_idx = r_idx = 0
    while u_idx < len(upcoming_games) or r_idx < len(recent_results):
        if u_idx < len(upcoming_games):
            ticker.append(upcoming_games[u_idx])
            u_idx += 1
        if r_idx < len(recent_results):
            ticker.append(recent_results[r_idx])
            r_idx += 1

    return ticker[:MAX_TICKER_ITEMS]


@router.get("")
async def get_scores():
    """Return cached live scores."""
    r = _get_redis()
    cached = r.get(CACHE_KEY)
    if cached:
        return {"data": _json.loads(cached)}

    scores = await _fetch_scores()
    if scores:
        r.setex(CACHE_KEY, CACHE_TTL, _json.dumps(scores))
    return {"data": scores}
