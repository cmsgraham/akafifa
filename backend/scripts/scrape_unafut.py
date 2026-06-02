#!/usr/bin/env python3
"""
Scrape the UNAFUT (Costa Rica Primera División) calendar page and generate
SQL INSERT statements for matches and match results.

Usage:
    python3 scripts/scrape_unafut.py > /tmp/unafut_matches.sql
    # Then review and run on the server
"""

import re
import sys
from datetime import datetime, timedelta, timezone
from html import unescape

# ── Constants ────────────────────────────────────────────────────────────────

CALENDAR_URL = "https://www.unafut.com/calendario/"

# CR tournament and stage IDs (from DB)
TOURNAMENT_ID = "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d"
JORNADA_REGULAR_STAGE_ID = "b1c2d3e4-f5a6-4b7c-8d9e-0f1a2b3c4d5e"

# Costa Rica timezone: UTC-6 (no DST)
CR_OFFSET = timezone(timedelta(hours=-6))

# Logo hash → UNAFUT abbreviation (derived from cross-referencing sidebar & calendar)
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

# UNAFUT abbreviation → our DB team short_code
# Teams already in DB: LDA, SAP, HER, CAR, SCA, SPO, LIB, PFC
# Need to add: GFC (Guadalupe FC), MPZ (Pérez Zeledón)
UNAFUT_TO_DB_CODE = {
    "SAP": "SAP",
    "LDA": "LDA",
    "PFC": "PFC",
    "CSH": "HER",
    "CSC": "CAR",
    "SFC": "SPO",
    "MPL": "LIB",
    "ASC": "SCA",
    "GFC": "GFC",  # new team
    "MPZ": "MPZ",  # new team
}

UNAFUT_FULL_NAMES = {
    "SAP": "Deportivo Saprissa",
    "LDA": "Liga Deportiva Alajuelense",
    "PFC": "Puntarenas FC",
    "CSH": "Club Sport Herediano",
    "CSC": "Club Sport Cartaginés",
    "SFC": "Sporting FC",
    "MPL": "Municipal Liberia",
    "ASC": "AD San Carlos",
    "GFC": "Guadalupe FC",
    "MPZ": "Municipal Pérez Zeledón",
}

# Spanish month names
MONTH_MAP = {
    "enero": 1, "febrero": 2, "marzo": 3, "abril": 4,
    "mayo": 5, "junio": 6, "julio": 7, "agosto": 8,
    "septiembre": 9, "octubre": 10, "noviembre": 11, "diciembre": 12,
}


def parse_date(date_str: str) -> datetime:
    """Parse '13 de Enero de 2026 a las 17:00' into a UTC datetime."""
    m = re.match(
        r"(\d+)\s+de\s+(\w+)\s+de\s+(\d{4})\s+a\s+las\s+(\d{1,2}):(\d{2})",
        date_str.strip(),
    )
    if not m:
        raise ValueError(f"Cannot parse date: {date_str!r}")
    day = int(m.group(1))
    month = MONTH_MAP[m.group(2).lower()]
    year = int(m.group(3))
    hour = int(m.group(4))
    minute = int(m.group(5))

    # Build CR local time, then convert to UTC
    cr_dt = datetime(year, month, day, hour, minute, tzinfo=CR_OFFSET)
    utc_dt = cr_dt.astimezone(timezone.utc)
    return utc_dt


def parse_score(result_str: str) -> tuple[int, int] | None:
    """Parse '3 - 1' into (3, 1). Return None if not a score (e.g. time only)."""
    m = re.match(r"(\d+)\s*-\s*(\d+)", result_str.strip())
    if m:
        return int(m.group(1)), int(m.group(2))
    return None


def scrape_html(html: str) -> list[dict]:
    """Extract all match data from the UNAFUT calendar HTML."""
    rows = re.findall(r"<tr class=\"sp-row.*?</tr>", html, re.DOTALL)
    matches = []

    for row in rows:
        # Date
        date_m = re.search(r"<date>(.*?)</date>", row)
        if not date_m:
            continue
        date_str = unescape(date_m.group(1))

        # Match ID and score/status — finished matches link to centro-de-juego,
        # upcoming ones link to previa-del-partido
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

        # Logo hashes (home, away)
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
            print(f"WARNING: match_id={unafut_match_id} has {len(logos)} logos", file=sys.stderr)
            continue

        home_unafut = LOGO_TO_UNAFUT.get(logos[0])
        away_unafut = LOGO_TO_UNAFUT.get(logos[1])
        if not home_unafut or not away_unafut:
            print(
                f"WARNING: Unknown logo hash in match_id={unafut_match_id}: "
                f"{logos[0]}, {logos[1]}",
                file=sys.stderr,
            )
            continue

        # Venue
        venue_m = re.search(
            r'data-label="Estadio"[^>]*>\s*(.*?)\s*</td>', row, re.DOTALL
        )
        venue = ""
        if venue_m:
            venue = re.sub(r"<[^>]+>", "", venue_m.group(1)).strip()
            venue = unescape(venue)

        # Jornada
        jornada_m = re.search(
            r'data-label="Jornada"[^>]*>\s*(.*?)\s*</td>', row, re.DOTALL
        )
        jornada = ""
        if jornada_m:
            jornada = re.sub(r"<[^>]+>", "", jornada_m.group(1)).strip()

        # Parse
        utc_dt = parse_date(date_str)
        score = parse_score(result_text)

        home_code = UNAFUT_TO_DB_CODE[home_unafut]
        away_code = UNAFUT_TO_DB_CODE[away_unafut]

        matches.append({
            "unafut_match_id": unafut_match_id,
            "home_code": home_code,
            "away_code": away_code,
            "home_name": UNAFUT_FULL_NAMES[home_unafut],
            "away_name": UNAFUT_FULL_NAMES[away_unafut],
            "kickoff_utc": utc_dt,
            "venue": venue,
            "jornada": jornada,
            "score": score,
        })

    return matches


def generate_sql(matches: list[dict]) -> str:
    """Generate SQL statements to insert matches."""
    lines = []
    lines.append("-- UNAFUT Costa Rica Clausura 2026 - Match Import")
    lines.append(f"-- Generated from {CALENDAR_URL}")
    lines.append(f"-- Total matches: {len(matches)}")
    lines.append("")

    # Add new teams if needed
    new_teams = {"GFC": "Guadalupe FC", "MPZ": "Municipal Pérez Zeledón"}
    for code, name in new_teams.items():
        lines.append(
            f"INSERT INTO teams (id, name, short_code, flag_url, created_at) "
            f"SELECT gen_random_uuid(), '{name}', '{code}', NULL, NOW() "
            f"WHERE NOT EXISTS (SELECT 1 FROM teams WHERE short_code = '{code}');"
        )
    lines.append("")

    # Insert matches
    lines.append("-- Matches")
    for m in matches:
        kickoff_str = m["kickoff_utc"].strftime("%Y-%m-%d %H:%M:%S+00")
        # Lock predictions 15 minutes before kickoff
        lock_dt = m["kickoff_utc"] - timedelta(minutes=15)
        lock_str = lock_dt.strftime("%Y-%m-%d %H:%M:%S+00")

        # Determine status
        if m["score"] is not None:
            status = "finished"
        elif m["kickoff_utc"] < datetime.now(timezone.utc):
            status = "finished"
        else:
            status = "scheduled"

        venue_sql = f"'{m['venue'].replace(chr(39), chr(39)*2)}'" if m["venue"] else "NULL"
        external_id = f"unafut_{m['unafut_match_id']}"

        lines.append(
            f"INSERT INTO matches (id, tournament_id, stage_id, home_team_id, away_team_id, "
            f"kickoff_utc, lock_at, venue, status, external_id, created_at, updated_at) "
            f"VALUES ("
            f"gen_random_uuid(), "
            f"'{TOURNAMENT_ID}', "
            f"'{JORNADA_REGULAR_STAGE_ID}', "
            f"(SELECT id FROM teams WHERE short_code = '{m['home_code']}'), "
            f"(SELECT id FROM teams WHERE short_code = '{m['away_code']}'), "
            f"'{kickoff_str}', "
            f"'{lock_str}', "
            f"{venue_sql}, "
            f"'{status}', "
            f"'{external_id}', "
            f"NOW(), NOW()"
            f") ON CONFLICT (external_id) DO NOTHING;"
        )

        # Insert result for finished matches
        if m["score"] is not None:
            home_score, away_score = m["score"]
            lines.append(
                f"INSERT INTO match_results (id, match_id, home_score, away_score, is_override, confirmed_at, created_at, updated_at) "
                f"SELECT gen_random_uuid(), m.id, {home_score}, {away_score}, false, NOW(), NOW(), NOW() "
                f"FROM matches m WHERE m.external_id = '{external_id}' "
                f"AND NOT EXISTS (SELECT 1 FROM match_results mr WHERE mr.match_id = m.id);"
            )
    
    lines.append("")
    lines.append(f"-- Summary: {len(matches)} matches imported")
    finished = sum(1 for m in matches if m["score"] is not None)
    scheduled = len(matches) - finished
    lines.append(f"-- Finished: {finished}, Scheduled: {scheduled}")

    # Print jornada breakdown
    jornadas = {}
    for m in matches:
        j = m["jornada"]
        jornadas[j] = jornadas.get(j, 0) + 1
    for j in sorted(jornadas.keys(), key=lambda x: int(x) if x.isdigit() else 0):
        lines.append(f"-- Jornada {j}: {jornadas[j]} matches")

    return "\n".join(lines)


def main():
    import subprocess

    # Accept a local HTML file as argument, or fetch from URL
    if len(sys.argv) > 1:
        print(f"Reading from file: {sys.argv[1]}", file=sys.stderr)
        with open(sys.argv[1]) as f:
            html = f.read()
    else:
        print("Fetching UNAFUT calendar...", file=sys.stderr)
        result = subprocess.run(
            ["curl", "-sL", CALENDAR_URL],
            capture_output=True, text=True,
        )
        if result.returncode != 0:
            print(f"ERROR: curl failed: {result.stderr}", file=sys.stderr)
            sys.exit(1)
        html = result.stdout

    print(f"HTML size: {len(html)} bytes", file=sys.stderr)
    matches = scrape_html(html)
    print(f"Parsed {len(matches)} matches", file=sys.stderr)

    if not matches:
        print("ERROR: No matches found!", file=sys.stderr)
        sys.exit(1)

    # Print summary to stderr
    jornadas = set(m["jornada"] for m in matches)
    print(f"Jornadas: {sorted(jornadas, key=lambda x: int(x) if x.isdigit() else 0)}", file=sys.stderr)

    teams = set()
    for m in matches:
        teams.add(m["home_code"])
        teams.add(m["away_code"])
    print(f"Teams: {sorted(teams)}", file=sys.stderr)

    # Print sample matches
    for m in matches[:3]:
        print(
            f"  {m['home_name']} vs {m['away_name']} | "
            f"{m['kickoff_utc'].strftime('%Y-%m-%d %H:%M UTC')} | "
            f"J{m['jornada']} | "
            f"Score: {m['score']}",
            file=sys.stderr,
        )

    # Generate SQL
    sql = generate_sql(matches)
    print(sql)


if __name__ == "__main__":
    main()
