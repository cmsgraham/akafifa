"""Abstract base for external soccer data providers."""

from abc import ABC, abstractmethod
from typing import Any


class SoccerAPIBase(ABC):
    """Interface that all soccer data providers must implement."""

    @abstractmethod
    async def fetch_tournaments(self) -> list[dict[str, Any]]:
        ...

    @abstractmethod
    async def fetch_teams(self, tournament_id: str) -> list[dict[str, Any]]:
        ...

    @abstractmethod
    async def fetch_matches(self, tournament_id: str) -> list[dict[str, Any]]:
        ...

    @abstractmethod
    async def fetch_match_result(self, match_id: str) -> dict[str, Any] | None:
        ...
