"""Sync UNAFUT (Costa Rica Primera División) match data from their website."""

import asyncio
import logging
import re
import subprocess
from datetime import datetime, timedelta, timezone
from html import unescape
from uuid import UUID

from sqlalchemy import select

from app.db.models import Match, MatchResult, Team
from app.db.session import async_session

logger = logging.getLogger(__name__)

CALENDAR_URL = "https://www.unafut.com/calendario/"

TOURNAMENT_ID = "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d"
JORNADA_REGULAR_STAGE_ID = "b1c2d3e4-f5a6-4b7c-8d9e-0f1a2b3c4d5e"

CR_OFFSET = timezone(timedelta(hours=-6))

LOGO_TO_UNAFUT = {
    "5e974ccea863a18ce07fd9e70416081c": "SAP",
    "f660695150336143e20535af8aee2c7b": "LDA",
    "7760b85b1386c2bfc6b025d8aa906eb4": "PFC",
    "557e566f3ea2a671d074999e2b3d232e": "CSH",
    "24cd4988e679ed7f8b599beda10eec04": "CSC",
    "660cd55a1803421e1a4e32782eb37b1b": "SFC",
    "69361fe76bcfdf51733654dfc64b922f": "MPL",
    "43843bd5e081a20e54045f497d2ffbec": "GFC",
    "be3aa44108e8d219929641a32f95baef": "MPZ",
    "1083b7787161b033bd59a5ca8809f3c8": "ASC",
}

UNAFUT_TO_DB_CODE = {
    "SAP": "SAP", "LDA": "LDA", "PFC": "PFC", "CSH": "HER",
    "CSC": "CAR", "SFC": "SPO", "MPL": "LIB", "ASC": "SCA",
    "GFC": "GFC", "MPZ": "MPZ",
}

MONTH_MAP = {
    "enero": 1, "febrero": 2, "marzo": 3, "abril": 4,
    "mayo": 5, "junio": 6, "julio": 7, "agosto": 8,
    "septiembre": 9, "octubre": 10, "noviembre": 11, "diciembre": 12,
}


def _parse_date(date_str: str) -> datetime:
    m = re.match(
        r"(\d+)\s+de\s+(\w+)\s+de\s+(\d{4})\s+a\s+las\s+(\d{1,2}):(\d{2})",
        date_str.strip(),
    )
    if not m:
        raise ValueError(f"Cannot parse date: {date_str!r}")
    cr_dt = datetime(
        int(m.group(3)), MONTH_MAP[m.group(2).lower()], int(m.group(1)),
        int(m.group(4)), int(m.group(5)), tzinfo=CR_OFFSET,
    )
    return cr_dt.astimezone(timezone.utc)


def _parse_score(result_str: str) -> tuple[int, int] | None:
    m = re.match(r"(\d+)\s*-\s*(\d+)", result_str.strip())
    return (int(m.group(1)), int(m.group(2))) if m else None


def _scrape_html(html: str) -> list[dict]:
    rows = re.findall(r"<tr class=\"sp-row.*?</tr>", html, re.DOTALL)
    matches = []

    for row in rows:
        date_m = re.search(r"<date>(.*?)</date>", row)
        if not date_m:
            continue

        score_m = re.search(
            r'<a href="/centro-de-juego/\?match_id=(\d+)"[^>]*>(.*?)</a>', row
        )
        previa_m = re.search(
            r'<a href="/previa-del-partido/\?match_id=(\d+)"[^>]*>(.*?)</a>', row
        )
        if score_m:
            unafut_match_id = score_m.group(1)
            result_text = unescape(score_m.group(2).strip())
        elif previa_m:
            unafut_match_id = previa_m.group(1)
            result_text = unescape(previa_m.group(2).strip())
        else:
            continue

        logo_urls = re.findall(
            r"https://images\.statsengine\.playbyplay\.api\.geniussports\.com/(\w+)S1\.png",
            row,
        )
        seen = set()
        logos = []
        for h in logo_urls:
            if h not in seen:
                seen.add(h)
                logos.append(h)
        if len(logos) != 2:
            continue

        home_unafut = LOGO_TO_UNAFUT.get(logos[0])
        away_unafut = LOGO_TO_UNAFUT.get(logos[1])
        if not home_unafut or not away_unafut:
            logger.warning("Unknown logo hash in match_id=%s", unafut_match_id)
            continue

        venue_m = re.search(r'data-label="Estadio"[^>]*>\s*(.*?)\s*</td>', row, re.DOTALL)
        venue = unescape(re.sub(r"<[^>]+>", "", venue_m.group(1)).strip()) if venue_m else ""

        matches.append({
            "external_id": f"unafut_{unafut_match_id}",
            "home_code": UNAFUT_TO_DB_CODE[home_unafut],
            "away_code": UNAFUT_TO_DB_CODE[away_unafut],
            "kickoff_utc": _parse_date(unescape(date_m.group(1))),
            "venue": venue,
            "score": _parse_score(result_text),
        })

    return matches


def _fetch_html() -> str:
    """Fetch the UNAFUT calendar page HTML via curl."""
    result = subprocess.run(
        ["curl", "-sL", CALENDAR_URL],
        capture_output=True, text=True, timeout=30,
    )
    if result.returncode != 0:
        raise RuntimeError(f"curl failed: {result.stderr}")
    return result.stdout


async def sync_unafut() -> dict:
    """Scrape UNAFUT calendar and upsert matches + results into DB.

    Returns a summary dict with created/updated/unchanged counts.
    """
    logger.info("Starting UNAFUT sync from %s", CALENDAR_URL)

    html = _fetch_html()
    scraped = _scrape_html(html)
    logger.info("Scraped %d matches from UNAFUT", len(scraped))

    if not scraped:
        return {"error": "No matches found on page", "html_size": len(html)}

    created = 0
    updated = 0
    results_added = 0
    unchanged = 0

    async with async_session() as db:
        # Build team code → id lookup
        team_rows = (await db.execute(select(Team.id, Team.short_code))).all()
        team_map: dict[str, UUID] = {r.short_code: r.id for r in team_rows if r.short_code}

        for m in scraped:
            home_id = team_map.get(m["home_code"])
            away_id = team_map.get(m["away_code"])
            if not home_id or not away_id:
                logger.warning("Team not found: %s or %s", m["home_code"], m["away_code"])
                continue

            ext_id = m["external_id"]
            kickoff = m["kickoff_utc"]
            lock_at = kickoff - timedelta(minutes=15)

            # Check if match exists
            existing = (await db.execute(
                select(Match).where(Match.external_id == ext_id)
            )).scalar_one_or_none()

            if existing:
                match_obj = existing
                if m["score"] is not None and existing.status == "scheduled":
                    existing.status = "finished"
                    updated += 1
                else:
                    unchanged += 1
            else:
                status = "finished" if m["score"] is not None else "scheduled"
                match_obj = Match(
                    tournament_id=TOURNAMENT_ID,
                    stage_id=JORNADA_REGULAR_STAGE_ID,
                    home_team_id=home_id,
                    away_team_id=away_id,
                    kickoff_utc=kickoff,
                    lock_at=lock_at,
                    venue=m["venue"] or None,
                    status=status,
                    external_id=ext_id,
                )
                db.add(match_obj)
                await db.flush()
                created += 1

            # Upsert result for finished matches
            if m["score"] is not None:
                home_score, away_score = m["score"]
                has_result = (await db.execute(
                    select(MatchResult).where(MatchResult.match_id == match_obj.id)
                )).scalar_one_or_none()

                if not has_result:
                    db.add(MatchResult(
                        match_id=match_obj.id,
                        home_score=home_score,
                        away_score=away_score,
                    ))
                    results_added += 1

        await db.commit()

    summary = {
        "scraped": len(scraped),
        "created": created,
        "updated": updated,
        "results_added": results_added,
        "unchanged": unchanged,
    }
    logger.info("UNAFUT sync complete: %s", summary)
    return summary


def run() -> dict:
    """Entry point for RQ worker (sync). Wraps the async function."""
    return asyncio.run(sync_unafut())
