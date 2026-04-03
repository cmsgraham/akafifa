"""Send prediction reminder emails for matches locking in ~24 hours."""

import logging

logger = logging.getLogger(__name__)


def run() -> None:
    logger.info("Running prediction reminder job")
    # TODO: find matches locking in ~24h, find users without predictions, enqueue emails
    logger.info("Prediction reminder job complete")
