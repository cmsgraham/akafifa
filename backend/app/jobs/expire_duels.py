"""Expire pending duel invitations that have passed their expires_at."""

import logging

logger = logging.getLogger(__name__)


def run() -> None:
    logger.info("Running duel expiration sweep")
    # TODO: update duel_challenges SET status='expired' WHERE status='pending' AND expires_at < NOW()
    logger.info("Duel expiration sweep complete")
