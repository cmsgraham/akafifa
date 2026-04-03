"""Football-Data.org provider implementation (stub)."""

from typing import Any

import httpx

from app.core.config import settings
from app.services.soccer_api.base import SoccerAPIBase


class FootballDataProvider(SoccerAPIBase):
    BASE_URL = "https://api.football-data.org/v4"

    def __init__(self) -> None:
        self.headers = {"X-Auth-Token": settings.SOCCER_API_KEY}

    async def fetch_tournaments(self) -> list[dict[str, Any]]:
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"{self.BASE_URL}/competitions",
                headers=self.headers,
            )
            resp.raise_for_status()
            return resp.json().get("competitions", [])

    async def fetch_teams(self, tournament_id: str) -> list[dict[str, Any]]:
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"{self.BASE_URL}/competitions/{tournament_id}/teams",
                headers=self.headers,
            )
            resp.raise_for_status()
            return resp.json().get("teams", [])

    async def fetch_matches(self, tournament_id: str) -> list[dict[str, Any]]:
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"{self.BASE_URL}/competitions/{tournament_id}/matches",
                headers=self.headers,
            )
            resp.raise_for_status()
            return resp.json().get("matches", [])

    async def fetch_match_result(self, match_id: str) -> dict[str, Any] | None:
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"{self.BASE_URL}/matches/{match_id}",
                headers=self.headers,
            )
            resp.raise_for_status()
            data = resp.json()
            score = data.get("score", {}).get("fullTime")
            if score and score.get("home") is not None:
                return {
                    "home_score": score["home"],
                    "away_score": score["away"],
                    "status": data.get("status"),
                }
            return None
