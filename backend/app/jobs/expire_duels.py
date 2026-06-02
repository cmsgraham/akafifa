"""Expire pending duel invitations that have passed their expires_at."""

import asyncio
import logging
from datetime import datetime, timezone

from sqlalchemy import select

from app.db.session import async_session
from app.db.models import DuelChallenge
from app.services.notifications import notify, NotifType

logger = logging.getLogger(__name__)


async def _expire() -> int:
    async with async_session() as db:
        now = datetime.now(timezone.utc)
        duels = list((await db.execute(
            select(DuelChallenge).where(
                DuelChallenge.status == "pending",
                DuelChallenge.expires_at < now,
            )
        )).scalars().all())

        for duel in duels:
            duel.status = "expired"
            await notify(
                db,
                user_id=duel.challenger_id,
                type=NotifType.DUEL_EXPIRED,
                title="Duel Expired",
                message="Your duel challenge expired without a response.",
                related_entity_type="duel",
                related_entity_id=duel.id,
                action_url="/duels",
                dedup_key=f"duel_expired:{duel.id}:{duel.challenger_id}",
            )
            await notify(
                db,
                user_id=duel.opponent_id,
                type=NotifType.DUEL_EXPIRED,
                title="Duel Expired",
                message="A duel challenge to you has expired.",
                related_entity_type="duel",
                related_entity_id=duel.id,
                action_url="/duels",
                dedup_key=f"duel_expired:{duel.id}:{duel.opponent_id}",
            )

        await db.commit()
        return len(duels)


def run() -> None:
    logger.info("Running duel expiration sweep")
    count = asyncio.run(_expire())
    logger.info("Duel expiration sweep complete: %d duels expired", count)
