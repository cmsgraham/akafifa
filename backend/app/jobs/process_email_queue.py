"""Process outbound email queue — picks up pending OutboundEmailJob rows and sends via SMTP."""

import asyncio
import logging
from datetime import datetime, timedelta, timezone

from sqlalchemy import select, update

from app.db.session import async_session
from app.db.models import OutboundEmailJob
from app.services.email.sender import send_email

logger = logging.getLogger(__name__)

MAX_ATTEMPTS = 5
BATCH_SIZE = 20
BACKOFF_BASE_SECONDS = 60  # 1m, 2m, 4m, 8m, 16m


async def _process_queue() -> dict:
    """Send pending emails with retry + exponential backoff."""
    now = datetime.now(timezone.utc)
    sent = 0
    failed = 0

    async with async_session() as db:
        # Fetch pending jobs ready for attempt
        jobs = (await db.execute(
            select(OutboundEmailJob)
            .where(
                OutboundEmailJob.status == "pending",
                (OutboundEmailJob.next_attempt_at.is_(None))
                | (OutboundEmailJob.next_attempt_at <= now),
            )
            .order_by(OutboundEmailJob.created_at)
            .limit(BATCH_SIZE)
        )).scalars().all()

        if not jobs:
            return {"sent": 0, "failed": 0}

        logger.info("Processing %d pending email jobs", len(jobs))

        for job in jobs:
            try:
                send_email(
                    to=job.to_address,
                    subject=job.subject,
                    body=job.body,
                )
                job.status = "sent"
                job.last_attempt_at = now
                job.attempts += 1
                sent += 1
                logger.info("Sent email to %s: %s", job.to_address, job.subject)
            except Exception as e:
                job.attempts += 1
                job.last_attempt_at = now
                job.error_log = str(e)

                if job.attempts >= MAX_ATTEMPTS:
                    job.status = "dead_letter"
                    logger.error(
                        "Email to %s dead-lettered after %d attempts: %s",
                        job.to_address, job.attempts, e,
                    )
                else:
                    backoff = BACKOFF_BASE_SECONDS * (2 ** (job.attempts - 1))
                    job.next_attempt_at = now + timedelta(seconds=backoff)
                    logger.warning(
                        "Email to %s failed (attempt %d/%d), retrying in %ds: %s",
                        job.to_address, job.attempts, MAX_ATTEMPTS, backoff, e,
                    )
                failed += 1

        await db.commit()

    return {"sent": sent, "failed": failed}


def run() -> None:
    """Entry point for rq worker."""
    result = asyncio.run(_process_queue())
    if result["sent"] or result["failed"]:
        logger.info("Email queue processed: %s", result)
