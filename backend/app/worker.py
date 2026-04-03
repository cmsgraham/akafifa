"""Background job worker — processes queued tasks from Redis."""

import logging
import sys
import time

from redis import Redis
from rq import Worker, Queue

from app.core.config import settings

logging.basicConfig(
    level=logging.INFO,
    format='{"time":"%(asctime)s","level":"%(levelname)s","module":"%(name)s","message":"%(message)s"}',
    stream=sys.stdout,
)
logger = logging.getLogger("worker")


def main() -> None:
    logger.info("Starting worker, connecting to Redis at %s", settings.REDIS_URL)

    # Retry Redis connection on startup
    conn = None
    for attempt in range(1, 11):
        try:
            conn = Redis.from_url(settings.REDIS_URL)
            conn.ping()
            logger.info("Redis connected on attempt %d", attempt)
            break
        except Exception as e:
            logger.warning("Redis not ready (attempt %d/10): %s", attempt, e)
            time.sleep(2)

    if conn is None:
        logger.error("Could not connect to Redis after 10 attempts, exiting.")
        sys.exit(1)

    queues = [
        Queue("email", connection=conn),
        Queue("scoring", connection=conn),
        Queue("sync", connection=conn),
        Queue("default", connection=conn),
    ]

    worker = Worker(queues, connection=conn)
    logger.info("Worker listening on queues: %s", [q.name for q in queues])
    worker.work()


if __name__ == "__main__":
    main()
