"""Periodic scheduler — enqueues recurring jobs into Redis queues."""

import logging
import sys
import time

from redis import Redis
from rq import Queue

from app.core.config import settings

logging.basicConfig(
    level=logging.INFO,
    format='{"time":"%(asctime)s","level":"%(levelname)s","module":"%(name)s","message":"%(message)s"}',
    stream=sys.stdout,
)
logger = logging.getLogger("scheduler")

# Schedule definitions: (interval_seconds, queue_name, job_function_path)
SCHEDULES = [
    (300, "sync", "app.jobs.sync_matches.run"),       # every 5 min
    (3600, "default", "app.jobs.expire_duels.run"),    # every hour
    (3600, "email", "app.jobs.send_reminders.run"),    # every hour
]


def main() -> None:
    logger.info("Starting scheduler, connecting to Redis at %s", settings.REDIS_URL)

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

    queues = {name: Queue(name, connection=conn) for _, name, _ in SCHEDULES}
    last_run: dict[str, float] = {}

    logger.info("Scheduler running with %d scheduled jobs", len(SCHEDULES))

    while True:
        now = time.time()
        for interval, queue_name, job_path in SCHEDULES:
            key = f"{queue_name}:{job_path}"
            if now - last_run.get(key, 0) >= interval:
                q = queues[queue_name]
                q.enqueue(job_path)
                last_run[key] = now
                logger.info("Enqueued %s on queue '%s'", job_path, queue_name)
        time.sleep(30)


if __name__ == "__main__":
    main()
