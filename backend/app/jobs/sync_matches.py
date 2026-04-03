"""Sync matches from external soccer API."""

import logging

logger = logging.getLogger(__name__)


def run() -> None:
    logger.info("Running match sync job")
    # TODO: call soccer API provider, upsert matches into DB
    logger.info("Match sync complete")
