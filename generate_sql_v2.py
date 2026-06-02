#!/usr/bin/env python3
"""Generate SQL to rebuild FIFA World Cup 2026 from the clean CSV."""

import csv
import uuid

TOURNAMENT_ID = "9762239c-b942-4d10-ab26-d121bbcb8ec3"

# Read CSV
with open("/Users/cmadriga/quiniela_mundial/FIFA_World_Cup_2026_matches_clean.csv") as f:
    reader = csv.DictReader(f)
    rows = list(reader)

print(f"Total matches in CSV: {len(rows)}")

# ── Existing DB teams we want to KEEP (name -> id) ──
DB_TEAMS = {
    "Algeria": "1890d9b6-6d50-4553-9497-05ea3c853982",
    "Argentina": "809a0176-4a2d-48cc-b88f-90084661e271",
    "Australia": "afd2b817-8526-4d85-a9fe-269b4ba94837",
    "Austria": "f50d9f1c-1b61-43e7-83a7-e7fdc83fc45d",
    "Belgium": "2cfc08a9-0779-4d63-b435-102ea805ecfa",
    "Bosnia-Herzegovina": "731a9135-d207-4f01-baf3-e65481fb5514",
    "Brazil": "83d939ae-1c34-40d5-8d2b-4f447e67a8be",
    "Canada": "967a6a5c-ede6-4d44-8a2d-dde67b0fd1e4",
    "Cape Verde Islands": "70638d8c-2e43-4104-8f71-dba46967f67d",
    "Colombia": "fb9fc382-2e53-4392-b665-f98ffa1e3539",
    "Congo DR": "d9cf414d-9a59-43f2-a675-6e559a7ff174",
    "Croatia": "25eb4827-7053-4ee7-9b96-fab2197506aa",
    "Curaçao": "5374505f-89c9-45ef-83f7-38efe7fdcf16",
    "Czechia": "72d81222-e5e2-4472-8c9b-d8348f1d9369",
    "Ecuador": "17f0ec54-7a22-4a5b-bbd5-c6c7ef29cf64",
    "Egypt": "c5d6fa70-be69-4ad2-b046-75567ec0b456",
    "England": "2dbbaa50-ede2-4af0-9ab1-f7eddb0976af",
    "France": "0ceae64b-f611-4112-824b-1f8dace7faf5",
    "Germany": "d8290020-b60e-4570-bf9d-261e5edc78a2",
    "Ghana": "875030c3-92e5-48c7-86f6-c568fe8fadc7",
    "Haiti": "d510ad4d-7a0f-4f63-888b-ff422303b588",
    "Iran": "14d2dba1-7d9c-4bbf-a682-4d9c1e37f43f",
    "Iraq": "49b9df43-f89e-4e08-b00a-84afc9aad37c",
    "Italy": "d14d5782-25a5-49d3-ada2-8edaf5999848",
    "Ivory Coast": "d5d03d06-964f-4501-a1db-2001f50a3efa",
    "Japan": "8211b3c6-7768-419a-b545-3fe0ab170972",
    "Jordan": "6eae1381-b787-40b3-b7d8-1ed70917f7a4",
    "Mexico": "57f93674-bb34-4fe5-a409-70fc5629a082",
    "Morocco": "854d93dc-98e9-4936-8e87-d79b488d2c6c",
    "Netherlands": "fbda49ef-0c0f-4544-a7e4-d3f05d5b902d",
    "New Zealand": "f3d2bbaa-fe2e-4cb7-a3da-5aea0cdb386c",
    "Norway": "57ce6124-61fc-45a5-96b1-15e534f3bea5",
    "Panama": "4305b577-b862-4b6d-9f2a-31af00318b9f",
    "Paraguay": "7d9fd44c-e2c1-4e21-ab88-456390037f32",
    "Portugal": "fb2f4943-3faf-4621-a215-b6287c1899dd",
    "Qatar": "b0d525be-5ed1-4493-8f90-255556d4dea4",
    "Saudi Arabia": "c21c6c42-acce-46dd-af54-ab05572ec246",
    "Scotland": "62b73454-925c-48d4-a9ce-c087c6067249",
    "Senegal": "a38ee035-c081-4684-a0f6-fbf1a527ad5f",
    "South Africa": "0a0ccba5-801c-4111-ab18-f389fff5cfa7",
    "South Korea": "abf8c18f-d09e-472a-b670-6fe41d40f51a",
    "Spain": "e0390c9f-018c-4c5c-9c5a-eeb2facf642a",
    "Sweden": "8197f406-f519-4599-a8f3-7ba8ea24d5d4",
    "Switzerland": "58ad478b-09c3-42a3-a3ff-1571ef9cbe20",
    "Tunisia": "868075dc-922d-4cdb-86eb-2b592d9c45ef",
    "Turkey": "068afc50-87e9-4276-ac82-6918d6a369be",
    "United States": "1dd888e5-1899-46a2-847c-744cb7328797",
    "Uruguay": "b2ce8541-d679-4971-b3bc-77e921a684cf",
    "Uzbekistan": "c50f6581-e1dc-4e05-897b-bd7ab6c70fcb",
}

# CSV name -> DB name mapping (handle encoding issues and name differences)
CSV_TO_DB = {
    "Trkiye": "Turkey",
    "Curaao": "Curaçao",
    "USA": "United States",
    "Cape Verde": "Cape Verde Islands",
    "DR Congo": "Congo DR",
    "Bosnia and Herzegovina": "Bosnia-Herzegovina",
}

# Existing stages
EXISTING_STAGES = {
    "Group Stage": "01c2a0c1-8c45-4c42-93a8-a1c560f7ccd2",
    "Quarterfinals": "912742aa-7464-44e2-9442-63d6c7f64e4a",
    "Final": "3924cafa-5c02-4948-89df-015eec88c7fb",
}

# New stages (check if they were created in previous run)
# We'll recreate them fresh
STAGE_MAP = {
    "Group Stage": "01c2a0c1-8c45-4c42-93a8-a1c560f7ccd2",
    "Quarterfinals": "912742aa-7464-44e2-9442-63d6c7f64e4a",
    "Final": "3924cafa-5c02-4948-89df-015eec88c7fb",
}

NEW_STAGES = {}
for stage_name in ["Round of 32", "Round of 16", "Semifinals", "Third Place Match"]:
    sid = str(uuid.uuid4())
    NEW_STAGES[stage_name] = sid
    STAGE_MAP[stage_name] = sid

# Collect all unique team names from CSV
all_csv_teams = set()
for r in rows:
    all_csv_teams.add(r["home_team"].strip())
    all_csv_teams.add(r["away_team"].strip())

# Build team lookup: figure out which teams need creating
new_teams = {}  # display_name -> (uuid, short_code)
team_lookup = {}  # csv_name -> uuid

for csv_name in sorted(all_csv_teams):
    db_name = CSV_TO_DB.get(csv_name, csv_name)
    if db_name in DB_TEAMS:
        team_lookup[csv_name] = DB_TEAMS[db_name]
    else:
        # Need to create this team
        if csv_name not in new_teams:
            tid = str(uuid.uuid4())
            sc = csv_name[:3].upper()
            new_teams[csv_name] = (tid, sc)
            team_lookup[csv_name] = tid

print(f"Teams mapped to existing DB: {len(team_lookup) - len(new_teams)}")
print(f"New teams to create: {len(new_teams)}")
for t in sorted(new_teams.keys()):
    print(f"  '{t}' -> {new_teams[t][0][:8]}...")

# ── Generate SQL ──
sql = []
sql.append("BEGIN;")
sql.append("")

# 1. Delete ALL existing matches and related data for FIFA tournament
sql.append("-- Clean existing FIFA data")
sql.append(f"DELETE FROM flash_challenge_answers WHERE challenge_id IN (SELECT id FROM flash_challenges WHERE match_id IN (SELECT id FROM matches WHERE tournament_id = '{TOURNAMENT_ID}'));")
sql.append(f"DELETE FROM flash_challenges WHERE match_id IN (SELECT id FROM matches WHERE tournament_id = '{TOURNAMENT_ID}');")
sql.append(f"DELETE FROM match_results WHERE match_id IN (SELECT id FROM matches WHERE tournament_id = '{TOURNAMENT_ID}');")
sql.append(f"DELETE FROM predictions WHERE match_id IN (SELECT id FROM matches WHERE tournament_id = '{TOURNAMENT_ID}');")
sql.append(f"DELETE FROM matches WHERE tournament_id = '{TOURNAMENT_ID}';")
sql.append("")

# 2. Delete old placeholder teams (from previous Excel import)
sql.append("-- Remove old placeholder teams from Excel import")
# Delete teams that are not real national teams (1A, 2B, 3ABCDF, W73, L101, UEFA A, FIFA 1, etc.)
old_placeholder_patterns = [
    "1A", "1C", "1D", "1E", "1F", "1G", "1H", "1I", "1J", "1K", "1L",
    "2A", "2B", "2C", "2D", "2E", "2F", "2G", "2H", "2I", "2J", "2K", "2L",
    "3ABCDF", "3AEHIJ", "3BEFIJ", "3CDFGH", "3CEFHI", "3DEIJL", "3EFGIJ", "3EHIJK",
    "FIFA 1", "FIFA 2", "UEFA A", "UEFA B", "UEFA C", "UEFA D",
]
# Also W and L teams
import re
# We'll just delete ALL teams not in our real DB_TEAMS set and not referenced by any match
# Safer: delete by name
for name in old_placeholder_patterns:
    safe = name.replace("'", "''")
    sql.append(f"DELETE FROM teams WHERE name = '{safe}';")

# Delete W* and L* placeholder teams
sql.append("DELETE FROM teams WHERE name ~ '^[WL][0-9]+$';")
sql.append("")

# 3. Delete old stages that were created from previous import, then recreate
sql.append("-- Remove old stages from previous import and recreate")
sql.append(f"DELETE FROM stages WHERE tournament_id = '{TOURNAMENT_ID}' AND id NOT IN ('{EXISTING_STAGES['Group Stage']}', '{EXISTING_STAGES['Quarterfinals']}', '{EXISTING_STAGES['Final']}');")
sql.append("")

# 4. Create new stages with correct ordering
sql.append("-- Create new stages")
stage_orders = {
    "Round of 32": 2,
    "Round of 16": 3,
    "Semifinals": 5,
    "Third Place Match": 6,
}
for stage_name, oidx in stage_orders.items():
    sid = NEW_STAGES[stage_name]
    sql.append(
        f"INSERT INTO stages (id, tournament_id, name, order_index, is_frozen, created_at) "
        f"VALUES ('{sid}', '{TOURNAMENT_ID}', '{stage_name}', {oidx}, false, NOW());"
    )

# Fix existing stage ordering
sql.append(f"UPDATE stages SET order_index = 1 WHERE id = '{EXISTING_STAGES['Group Stage']}';")
sql.append(f"UPDATE stages SET order_index = 4 WHERE id = '{EXISTING_STAGES['Quarterfinals']}';")
sql.append(f"UPDATE stages SET order_index = 7 WHERE id = '{EXISTING_STAGES['Final']}';")
sql.append("")

# 5. Create new placeholder teams
sql.append("-- Create new placeholder teams for Round of 32 and later")
for team_name in sorted(new_teams.keys()):
    tid, sc = new_teams[team_name]
    safe = team_name.replace("'", "''")
    sql.append(
        f"INSERT INTO teams (id, name, short_code, created_at) "
        f"VALUES ('{tid}', '{safe}', '{sc}', NOW());"
    )
sql.append("")

# 6. Rename Turkey -> Türkiye in the DB for accuracy
sql.append("-- Fix team names for accuracy")
sql.append(f"UPDATE teams SET name = 'Türkiye' WHERE id = '068afc50-87e9-4276-ac82-6918d6a369be';")
sql.append(f"UPDATE teams SET name = 'Cape Verde' WHERE id = '70638d8c-2e43-4104-8f71-dba46967f67d';")
sql.append(f"UPDATE teams SET name = 'DR Congo' WHERE id = 'd9cf414d-9a59-43f2-a675-6e559a7ff174';")
sql.append(f"UPDATE teams SET name = 'Bosnia and Herzegovina' WHERE id = '731a9135-d207-4f01-baf3-e65481fb5514';")
sql.append("")

# 7. Insert all 104 matches
sql.append("-- Insert all 104 matches")
from datetime import datetime, timedelta

for i, r in enumerate(rows, 1):
    home = r["home_team"].strip()
    away = r["away_team"].strip()
    kickoff = r["kickoff_utc"].strip()
    stage = r["stage"].strip()
    venue = r["venue"].strip()

    stage_id = STAGE_MAP[stage]
    home_id = team_lookup[home]
    away_id = team_lookup[away]

    # Parse kickoff for lock_at calculation
    dt = datetime.fromisoformat(kickoff.replace("Z", "+00:00"))
    lock_dt = dt - timedelta(hours=1)

    match_id = str(uuid.uuid4())
    safe_venue = venue.replace("'", "''")

    # Notes: match number + stage
    notes = f"Match #{i} | {stage}"
    safe_notes = notes.replace("'", "''")

    sql.append(
        f"INSERT INTO matches (id, tournament_id, stage_id, home_team_id, away_team_id, "
        f"kickoff_utc, lock_at, venue, status, external_id, notes, created_at, updated_at) VALUES ("
        f"'{match_id}', '{TOURNAMENT_ID}', '{stage_id}', '{home_id}', '{away_id}', "
        f"'{kickoff}', "
        f"'{lock_dt.strftime('%Y-%m-%dT%H:%M:%SZ')}', "
        f"'{safe_venue}', 'scheduled', 'M{i}', '{safe_notes}', NOW(), NOW());"
    )

sql.append("")
sql.append("COMMIT;")

output = "\n".join(sql)
with open("/Users/cmadriga/quiniela_mundial/update_fifa_v2.sql", "w") as f:
    f.write(output)

match_count = sum(1 for l in sql if "INSERT INTO matches" in l)
print(f"\nSQL lines: {len(sql)}")
print(f"Match inserts: {match_count}")
print(f"New stages: {len(NEW_STAGES)}")
