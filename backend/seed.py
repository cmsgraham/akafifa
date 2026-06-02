"""Seed script — populates the database with demo data for immediate demonstration.

Usage:
    python seed.py                  # Seed demo data
    python seed.py --make-admin EMAIL  # Promote a user to admin

See design document Section 16 for full data specifications.
"""

import argparse
import asyncio
import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import select

from app.core.config import settings
from app.core.security import hash_password
from app.db.models import (
    Comment,
    DuelChallenge,
    FlashChallenge,
    FlashChallengeAnswer,
    FlashChallengeOption,
    Match,
    MatchResult,
    Prediction,
    Prize,
    Stage,
    Team,
    Tournament,
    User,
    UserProfile,
)
from app.db.session import async_session


def utcnow():
    return datetime.now(timezone.utc)


DEFAULT_PASSWORD = "Password123!"


async def seed_demo_data():
    """Seed the database with demo data per Section 16."""
    async with async_session() as db:
        # Check if already seeded
        result = await db.execute(select(Tournament).limit(1))
        if result.scalar_one_or_none():
            print("Database already seeded. Skipping.")
            return

        # ── Tournament ───────────────────────────────────────
        tournament = Tournament(
            name="FIFA World Cup 2026",
            season="2026",
            status="active",
        )
        db.add(tournament)
        await db.flush()

        # ── Teams (8) ────────────────────────────────────────
        team_names = [
            ("Brazil", "BRA"), ("Germany", "GER"), ("Argentina", "ARG"),
            ("France", "FRA"), ("Spain", "ESP"), ("England", "ENG"),
            ("Italy", "ITA"), ("Mexico", "MEX"),
        ]
        teams = []
        for name, code in team_names:
            team = Team(name=name, short_code=code)
            db.add(team)
            teams.append(team)
        await db.flush()

        # ── Stages (3) ──────────────────────────────────────
        stages = []
        for idx, name in enumerate(["Group Stage", "Quarterfinals", "Final"], 1):
            stage = Stage(
                tournament_id=tournament.id, name=name, order_index=idx
            )
            db.add(stage)
            stages.append(stage)
        await db.flush()

        # ── Users (5: 1 admin + 4 regular) ──────────────────
        users = []
        user_data = [
            ("admin@company.com", "Admin User", "admin"),
            ("alice@company.com", "Alice Johnson", "user"),
            ("bob@company.com", "Bob Smith", "user"),
            ("carol@company.com", "Carol Martinez", "user"),
            ("dave@company.com", "Dave Wilson", "user"),
        ]
        for email, name, role in user_data:
            user = User(
                email=email,
                password_hash=hash_password(DEFAULT_PASSWORD),
                role=role,
            )
            db.add(user)
            users.append(user)
        await db.flush()

        for user, (_, name, _) in zip(users, user_data):
            profile = UserProfile(user_id=user.id, display_name=name)
            db.add(profile)
        await db.flush()

        # ── Matches (6: 2 upcoming, 2 locked, 2 confirmed) ──
        now = utcnow()
        match_specs = [
            # Upcoming
            (teams[0], teams[1], now + timedelta(days=3), stages[0], "scheduled"),
            (teams[2], teams[3], now + timedelta(days=5), stages[0], "scheduled"),
            # Locked / Live
            (teams[4], teams[5], now - timedelta(hours=1), stages[1], "live"),
            (teams[6], teams[7], now - timedelta(minutes=30), stages[1], "live"),
            # Confirmed
            (teams[0], teams[2], now - timedelta(days=2), stages[0], "confirmed"),
            (teams[1], teams[3], now - timedelta(days=3), stages[0], "confirmed"),
        ]
        matches = []
        for home, away, kickoff, stage, status in match_specs:
            match = Match(
                tournament_id=tournament.id,
                stage_id=stage.id,
                home_team_id=home.id,
                away_team_id=away.id,
                kickoff_utc=kickoff,
                lock_at=kickoff - timedelta(hours=1),
                status=status,
                venue="MetLife Stadium, New Jersey",
            )
            db.add(match)
            matches.append(match)
        await db.flush()

        # ── Match Results (for confirmed matches) ────────────
        results_data = [(matches[4], 2, 1), (matches[5], 0, 0)]
        for match, home_score, away_score in results_data:
            mr = MatchResult(
                match_id=match.id,
                home_score=home_score,
                away_score=away_score,
                confirmed_by=users[0].id,
            )
            db.add(mr)
        await db.flush()

        # ── Predictions (all 5 users for both confirmed matches)
        from app.services.scoring import calculate_points

        for match_obj, (actual_h, actual_a) in zip(
            [matches[4], matches[5]], [(2, 1), (0, 0)]
        ):
            pred_scores = [(2, 1), (3, 0), (1, 1), (0, 2), (2, 1)]
            for user, (ph, pa) in zip(users, pred_scores):
                scoring = calculate_points(ph, pa, actual_h, actual_a)
                pred = Prediction(
                    user_id=user.id,
                    match_id=match_obj.id,
                    home_score=ph,
                    away_score=pa,
                    points=scoring.points,
                    result_type=scoring.result_type,
                )
                db.add(pred)
        await db.flush()

        # ── Comments (10 across 2 matches) ───────────────────
        comment_texts = [
            "Great match!", "I think we'll win.", "Defense looks solid.",
            "What a goal!", "This is going to be close.",
            "Exciting game!", "Didn't see that coming.", "Come on!",
            "Best match of the tournament.", "Incredible atmosphere.",
        ]
        for i, text in enumerate(comment_texts):
            comment = Comment(
                match_id=matches[4].id if i < 5 else matches[5].id,
                user_id=users[i % 5].id,
                body=text,
            )
            db.add(comment)
        await db.flush()

        # ── Flash Challenges (2: 1 open yes/no, 1 resolved MC)
        # Open yes/no
        fc1 = FlashChallenge(
            tournament_id=tournament.id,
            match_id=matches[0].id,
            scope="match",
            title="Will there be a goal in the first 10 minutes?",
            type="yes_no",
            points_value=2,
            open_at=now - timedelta(hours=1),
            close_at=now + timedelta(days=2),
            resolution_method="manual",
            status="open",
        )
        db.add(fc1)
        await db.flush()

        for label in ["Yes", "No"]:
            opt = FlashChallengeOption(challenge_id=fc1.id, label=label)
            db.add(opt)
        await db.flush()

        # Resolved multiple choice
        fc2 = FlashChallenge(
            tournament_id=tournament.id,
            stage_id=stages[0].id,
            scope="stage",
            title="Which team will score the most goals in the group stage?",
            type="multiple_choice",
            points_value=3,
            open_at=now - timedelta(days=5),
            close_at=now - timedelta(days=1),
            resolution_method="manual",
            status="resolved",
            resolved_at=now - timedelta(hours=12),
        )
        db.add(fc2)
        await db.flush()

        mc_options = []
        for label in ["Brazil", "Germany", "Argentina", "France"]:
            opt = FlashChallengeOption(challenge_id=fc2.id, label=label)
            db.add(opt)
            mc_options.append(opt)
        await db.flush()

        fc2.correct_option_id = mc_options[0].id  # Brazil

        # ── Duels (1 completed, 1 pending) ──────────────────
        duel1 = DuelChallenge(
            match_id=matches[4].id,
            challenger_id=users[1].id,
            opponent_id=users[2].id,
            stake_points=5,
            status="completed",
            winner_id=users[1].id,
            challenger_score=3,
            opponent_score=1,
            expires_at=now - timedelta(days=1),
        )
        db.add(duel1)

        duel2 = DuelChallenge(
            match_id=matches[0].id,
            challenger_id=users[1].id,
            opponent_id=users[3].id,
            stake_points=3,
            status="pending",
            expires_at=now + timedelta(hours=24),
        )
        db.add(duel2)

        # ── Prize (1 for tournament winner) ──────────────────
        prize = Prize(
            tournament_id=tournament.id,
            title="Tournament Champion",
            description="Winner of the overall prediction tournament.",
        )
        db.add(prize)

        await db.commit()
        print("Demo data seeded successfully!")
        print(f"\n  Admin login: admin@company.com / {DEFAULT_PASSWORD}")
        print(f"  User login:  alice@company.com / {DEFAULT_PASSWORD}")


async def make_admin(email: str):
    """Promote a user to admin role."""
    async with async_session() as db:
        result = await db.execute(select(User).where(User.email == email))
        user = result.scalar_one_or_none()
        if not user:
            print(f"User with email '{email}' not found.")
            return
        user.role = "admin"
        await db.commit()
        print(f"User '{email}' promoted to admin.")


def main():
    parser = argparse.ArgumentParser(description="Seed demo data or manage admin users")
    parser.add_argument("--make-admin", type=str, help="Promote a user to admin by email")
    args = parser.parse_args()

    if args.make_admin:
        asyncio.run(make_admin(args.make_admin))
    else:
        asyncio.run(seed_demo_data())


if __name__ == "__main__":
    main()
