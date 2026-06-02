#!/usr/bin/env python3
"""Generate SQL to update FIFA World Cup 2026 matches from the Excel schedule."""

import openpyxl
import uuid
import re

wb = openpyxl.load_workbook(
    "/Users/cmadriga/quiniela_mundial/FIFA Men's World Cup 2026 Sortable Schedule.xlsx",
    data_only=True,
)
ws = wb["Sheet1"]

TOURNAMENT_ID = "9762239c-b942-4d10-ab26-d121bbcb8ec3"

# Existing stages
EXISTING_STAGES = {
    "Group Stage": "01c2a0c1-8c45-4c42-93a8-a1c560f7ccd2",
    "Quarterfinals": "912742aa-7464-44e2-9442-63d6c7f64e4a",
    "Final": "3924cafa-5c02-4948-89df-015eec88c7fb",
}

# Stages we need (mapped from Excel stage names)
STAGE_MAP = {}
stage_order = [
    "Group A", "Group B", "Group C", "Group D", "Group E", "Group F",
    "Group G", "Group H", "Group I", "Group J", "Group K", "Group L",
    "Round of 32", "Round of 16", "Quarterfinals", "Semifinals",
    "Third Place", "Final",
]

# We'll map all Group X -> Group Stage, and create new stages for the rest
NEW_STAGES = {}
for s in stage_order:
    if s.startswith("Group"):
        STAGE_MAP[s] = EXISTING_STAGES["Group Stage"]
    elif s == "Quarterfinals":
        STAGE_MAP[s] = EXISTING_STAGES["Quarterfinals"]
    elif s == "Final":
        STAGE_MAP[s] = EXISTING_STAGES["Final"]
    else:
        sid = str(uuid.uuid4())
        NEW_STAGES[s] = sid
        STAGE_MAP[s] = sid

# Existing DB teams (name -> id)
db_teams = {
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

# Excel name -> DB name mapping
NAME_MAP = {
    "Cape Verde": "Cape Verde Islands",
    "Curacao": "Curaçao",
}

# Short codes for new placeholder teams
SHORT_CODES = {
    "FIFA 1": "FI1", "FIFA 2": "FI2",
    "UEFA A": "UFA", "UEFA B": "UFB", "UEFA C": "UFC", "UEFA D": "UFD",
}

# Collect all unique team names from Excel
all_excel_teams = set()
for row_idx in range(2, 106):
    t1 = ws.cell(row=row_idx, column=3).value
    t2 = ws.cell(row=row_idx, column=4).value
    if t1:
        all_excel_teams.add(t1.strip())
    if t2:
        all_excel_teams.add(t2.strip())

# Determine which teams need to be created
new_teams = {}  # excel_name -> uuid
for team_name in sorted(all_excel_teams):
    db_name = NAME_MAP.get(team_name, team_name)
    if db_name not in db_teams:
        tid = str(uuid.uuid4())
        new_teams[team_name] = tid
        db_teams[db_name] = tid

# Build team_lookup: excel_name -> uuid
team_lookup = {}
for team_name in all_excel_teams:
    db_name = NAME_MAP.get(team_name, team_name)
    team_lookup[team_name] = db_teams[db_name]


# ── Generate SQL ──
sql_lines = ["BEGIN;", ""]

# 1. Create new stages
# Order: Group=1, R32=2, R16=3, QF=4(existing), SF=5, Third=6, Final=7(existing)
new_stage_orders = {"Round of 32": 2, "Round of 16": 3, "Semifinals": 5, "Third Place": 6}
for stage_name in ["Round of 32", "Round of 16", "Semifinals", "Third Place"]:
    if stage_name in NEW_STAGES:
        oidx = new_stage_orders[stage_name]
        sid = NEW_STAGES[stage_name]
        sql_lines.append(
            f"INSERT INTO stages (id, tournament_id, name, order_index, is_frozen, created_at) "
            f"VALUES ('{sid}', '{TOURNAMENT_ID}', '{stage_name}', {oidx}, false, NOW());"
        )

# Fix existing stages order: Group=1, R32=2, R16=3, QF=4, SF=5, 3rd=6, Final=7
sql_lines.append(f"UPDATE stages SET order_index = 1 WHERE id = '{EXISTING_STAGES['Group Stage']}';")
sql_lines.append(f"UPDATE stages SET order_index = 4 WHERE id = '{EXISTING_STAGES['Quarterfinals']}';")
sql_lines.append(f"UPDATE stages SET order_index = 7 WHERE id = '{EXISTING_STAGES['Final']}';")
sql_lines.append("")

# 2. Create new teams
sql_lines.append("-- New placeholder teams")
for team_name in sorted(new_teams.keys()):
    tid = new_teams[team_name]
    sc = SHORT_CODES.get(team_name, team_name[:3].upper())
    safe_name = team_name.replace("'", "''")
    sql_lines.append(
        f"INSERT INTO teams (id, name, short_code, created_at) "
        f"VALUES ('{tid}', '{safe_name}', '{sc}', NOW());"
    )
sql_lines.append("")

# 3. Delete existing matches (and their results/predictions/flash_challenges)
sql_lines.append("-- Clear existing FIFA matches")
sql_lines.append(
    f"DELETE FROM flash_challenge_answers WHERE challenge_id IN "
    f"(SELECT id FROM flash_challenges WHERE match_id IN "
    f"(SELECT id FROM matches WHERE tournament_id = '{TOURNAMENT_ID}'));"
)
sql_lines.append(
    f"DELETE FROM flash_challenges WHERE match_id IN "
    f"(SELECT id FROM matches WHERE tournament_id = '{TOURNAMENT_ID}');"
)
sql_lines.append(
    f"DELETE FROM match_results WHERE match_id IN "
    f"(SELECT id FROM matches WHERE tournament_id = '{TOURNAMENT_ID}');"
)
sql_lines.append(
    f"DELETE FROM predictions WHERE match_id IN "
    f"(SELECT id FROM matches WHERE tournament_id = '{TOURNAMENT_ID}');"
)
sql_lines.append(f"DELETE FROM matches WHERE tournament_id = '{TOURNAMENT_ID}';")
sql_lines.append("")

# 4. Insert all 104 matches
sql_lines.append("-- Insert all 104 matches")
for row_idx in range(2, 106):
    stage = ws.cell(row=row_idx, column=1).value
    kickoff = ws.cell(row=row_idx, column=2).value  # datetime in EDT (UTC-4)
    team1 = ws.cell(row=row_idx, column=3).value
    team2 = ws.cell(row=row_idx, column=4).value
    match_num = ws.cell(row=row_idx, column=5).value
    venue = ws.cell(row=row_idx, column=6).value

    if not stage or not team1 or not team2:
        continue

    team1 = team1.strip()
    team2 = team2.strip()
    stage = stage.strip()

    stage_id = STAGE_MAP[stage]
    home_id = team_lookup[team1]
    away_id = team_lookup[team2]

    # Convert EDT (UTC-4) to UTC by adding 4 hours
    from datetime import timedelta
    kickoff_utc = kickoff + timedelta(hours=4)
    # Lock 1 hour before kickoff
    lock_at = kickoff_utc - timedelta(hours=1)

    match_id = str(uuid.uuid4())
    match_num_int = int(match_num) if match_num else row_idx - 1
    safe_venue = venue.replace("'", "''") if venue else ""

    # Build notes with match number and original team labels for knockout
    notes_parts = [f"Match #{match_num_int}"]
    if stage:
        notes_parts.append(stage)
    notes = " | ".join(notes_parts)

    sql_lines.append(
        f"INSERT INTO matches (id, tournament_id, stage_id, home_team_id, away_team_id, "
        f"kickoff_utc, lock_at, venue, status, external_id, notes, created_at, updated_at) VALUES ("
        f"'{match_id}', '{TOURNAMENT_ID}', '{stage_id}', '{home_id}', '{away_id}', "
        f"'{kickoff_utc.strftime('%Y-%m-%d %H:%M:%S+00')}', "
        f"'{lock_at.strftime('%Y-%m-%d %H:%M:%S+00')}', "
        f"'{safe_venue}', 'scheduled', 'M{match_num_int}', '{notes}', NOW(), NOW());"
    )

sql_lines.append("")
sql_lines.append("COMMIT;")

sql = "\n".join(sql_lines)
with open("/Users/cmadriga/quiniela_mundial/update_fifa.sql", "w") as f:
    f.write(sql)

print(f"Generated {len(sql_lines)} SQL lines")
print(f"New teams: {len(new_teams)}")
print(f"New stages: {len(NEW_STAGES)}")

# Count matches
match_count = sum(1 for l in sql_lines if l.startswith("INSERT INTO matches"))
print(f"Match inserts: {match_count}")
