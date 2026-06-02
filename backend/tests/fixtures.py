"""Shared test fixtures for unit and integration tests.

Provides:
- 2 users (1 regular, 1 admin) with full profiles
- 1 tournament with 3 stages
- 8 teams
- 6 matches: 2 upcoming, 2 locked, 2 confirmed with results
- Predictions in all states (scored, unscored, missing)
- 1 active duel, 1 expired duel
- 2 flash challenges: 1 open, 1 resolved
- 10 sample comments across 2 matches
"""

import uuid
from datetime import datetime, timedelta, timezone

import pytest


def utcnow():
    return datetime.now(timezone.utc)


# ── Users ────────────────────────────────────────────────────

ADMIN_USER_ID = uuid.UUID("00000000-0000-0000-0000-000000000001")
REGULAR_USER_ID = uuid.UUID("00000000-0000-0000-0000-000000000002")
USER3_ID = uuid.UUID("00000000-0000-0000-0000-000000000003")
USER4_ID = uuid.UUID("00000000-0000-0000-0000-000000000004")
USER5_ID = uuid.UUID("00000000-0000-0000-0000-000000000005")

# ── Tournament ───────────────────────────────────────────────

TOURNAMENT_ID = uuid.UUID("10000000-0000-0000-0000-000000000001")

# ── Stages ───────────────────────────────────────────────────

STAGE_GROUP_ID = uuid.UUID("20000000-0000-0000-0000-000000000001")
STAGE_QF_ID = uuid.UUID("20000000-0000-0000-0000-000000000002")
STAGE_FINAL_ID = uuid.UUID("20000000-0000-0000-0000-000000000003")

# ── Teams ────────────────────────────────────────────────────

TEAM_IDS = [uuid.UUID(f"30000000-0000-0000-0000-00000000000{i}") for i in range(1, 9)]

# ── Matches ──────────────────────────────────────────────────

MATCH_UPCOMING_1 = uuid.UUID("40000000-0000-0000-0000-000000000001")
MATCH_UPCOMING_2 = uuid.UUID("40000000-0000-0000-0000-000000000002")
MATCH_LOCKED_1 = uuid.UUID("40000000-0000-0000-0000-000000000003")
MATCH_LOCKED_2 = uuid.UUID("40000000-0000-0000-0000-000000000004")
MATCH_CONFIRMED_1 = uuid.UUID("40000000-0000-0000-0000-000000000005")
MATCH_CONFIRMED_2 = uuid.UUID("40000000-0000-0000-0000-000000000006")


@pytest.fixture
def sample_users():
    return [
        {
            "id": ADMIN_USER_ID,
            "email": "admin@company.com",
            "role": "admin",
            "display_name": "Admin User",
        },
        {
            "id": REGULAR_USER_ID,
            "email": "user@company.com",
            "role": "user",
            "display_name": "Regular User",
        },
        {
            "id": USER3_ID,
            "email": "user3@company.com",
            "role": "user",
            "display_name": "User Three",
        },
        {
            "id": USER4_ID,
            "email": "user4@company.com",
            "role": "user",
            "display_name": "User Four",
        },
        {
            "id": USER5_ID,
            "email": "user5@company.com",
            "role": "user",
            "display_name": "User Five",
        },
    ]


@pytest.fixture
def sample_tournament():
    return {
        "id": TOURNAMENT_ID,
        "name": "World Cup 2026",
        "season": "2026",
        "status": "active",
    }


@pytest.fixture
def sample_stages():
    return [
        {"id": STAGE_GROUP_ID, "tournament_id": TOURNAMENT_ID, "name": "Group Stage", "order_index": 1},
        {"id": STAGE_QF_ID, "tournament_id": TOURNAMENT_ID, "name": "Quarterfinals", "order_index": 2},
        {"id": STAGE_FINAL_ID, "tournament_id": TOURNAMENT_ID, "name": "Final", "order_index": 3},
    ]


@pytest.fixture
def sample_teams():
    names = ["Brazil", "Germany", "Argentina", "France", "Spain", "England", "Italy", "Mexico"]
    return [
        {"id": TEAM_IDS[i], "name": names[i], "short_code": names[i][:3].upper()}
        for i in range(8)
    ]


@pytest.fixture
def sample_matches():
    now = utcnow()
    return [
        {
            "id": MATCH_UPCOMING_1,
            "status": "scheduled",
            "kickoff_utc": now + timedelta(days=3),
            "lock_at": now + timedelta(days=3, hours=-1),
        },
        {
            "id": MATCH_UPCOMING_2,
            "status": "scheduled",
            "kickoff_utc": now + timedelta(days=5),
            "lock_at": now + timedelta(days=5, hours=-1),
        },
        {
            "id": MATCH_LOCKED_1,
            "status": "live",
            "kickoff_utc": now - timedelta(hours=1),
            "lock_at": now - timedelta(hours=2),
        },
        {
            "id": MATCH_LOCKED_2,
            "status": "live",
            "kickoff_utc": now - timedelta(minutes=30),
            "lock_at": now - timedelta(hours=1, minutes=30),
        },
        {
            "id": MATCH_CONFIRMED_1,
            "status": "confirmed",
            "kickoff_utc": now - timedelta(days=2),
            "lock_at": now - timedelta(days=2, hours=-1),
        },
        {
            "id": MATCH_CONFIRMED_2,
            "status": "confirmed",
            "kickoff_utc": now - timedelta(days=3),
            "lock_at": now - timedelta(days=3, hours=-1),
        },
    ]
