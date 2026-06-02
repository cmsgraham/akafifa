"""Send prediction reminder emails for matches locking in ~24 hours."""

import asyncio
import logging
from datetime import datetime, timedelta, timezone

from sqlalchemy import select, and_, exists

from app.db.session import async_session
from app.db.models import Match, MatchResult, OutboundEmailJob, Prediction, Team, User, UserProfile
from app.services.email.sender import load_template

logger = logging.getLogger(__name__)


async def _send_reminders() -> dict:
    """Find matches locking within 23-25 hours and email users who haven't predicted."""
    now = datetime.now(timezone.utc)
    window_start = now + timedelta(hours=23)
    window_end = now + timedelta(hours=25)
    sent = 0

    async with async_session() as db:
        # Find matches locking in ~24 hours that haven't finished
        matches = (await db.execute(
            select(Match).where(
                Match.lock_at.isnot(None),
                Match.lock_at >= window_start,
                Match.lock_at <= window_end,
                Match.status.in_(["scheduled", "timed"]),
            )
        )).scalars().all()

        if not matches:
            return {"sent": 0, "matches_checked": 0}

        # Get all active users
        all_users = (await db.execute(
            select(User, UserProfile)
            .join(UserProfile, UserProfile.user_id == User.id)
            .where(User.is_active.is_(True))
        )).all()

        for match in matches:
            # Get team names
            home_team = (await db.execute(
                select(Team).where(Team.id == match.home_team_id)
            )).scalar_one_or_none()
            away_team = (await db.execute(
                select(Team).where(Team.id == match.away_team_id)
            )).scalar_one_or_none()
            home_name = home_team.name if home_team else "Home"
            away_name = away_team.name if away_team else "Away"

            # Get users who already predicted
            predicted_user_ids = set(
                row[0] for row in (await db.execute(
                    select(Prediction.user_id).where(Prediction.match_id == match.id)
                )).all()
            )

            for user, profile in all_users:
                if user.id in predicted_user_ids:
                    continue

                # Check if we already sent a reminder for this match to this user
                existing = (await db.execute(
                    select(OutboundEmailJob).where(
                        OutboundEmailJob.to_address == user.email,
                        OutboundEmailJob.subject.contains(f"{home_name} vs {away_name}"),
                        OutboundEmailJob.subject.contains("Reminder"),
                    ).limit(1)
                )).scalar_one_or_none()
                if existing:
                    continue

                display = profile.display_name if profile else user.email.split("@")[0]
                body = load_template(
                    "prediction_reminder.txt",
                    display_name=display,
                    home_team=home_name,
                    away_team=away_name,
                    kickoff_time=match.kickoff.strftime("%B %d, %Y at %H:%M") if match.kickoff else "TBD",
                    lock_at=match.lock_at.strftime("%B %d, %Y at %H:%M") if match.lock_at else "TBD",
                )

                db.add(OutboundEmailJob(
                    to_address=user.email,
                    subject=f"Prediction Reminder: {home_name} vs {away_name}",
                    body=body,
                ))
                sent += 1

        await db.commit()

    return {"sent": sent, "matches_checked": len(matches)}


def run() -> None:
    logger.info("Running prediction reminder job")
    result = asyncio.run(_send_reminders())
    logger.info("Prediction reminder job complete: %s", result)
