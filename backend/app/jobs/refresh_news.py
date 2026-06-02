"""Scheduled job: refresh the RSS news cache."""

import asyncio
import logging

logger = logging.getLogger("worker")


def run() -> None:
    from app.api.v1.news import refresh_news_cache

    count = asyncio.get_event_loop().run_until_complete(refresh_news_cache())
    logger.info("News cache refreshed — %d headlines", count)
