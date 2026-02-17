import os

from redis import Redis
from rq import Queue

from .constants import (
    ACTIVE_RUN_LOCK_KEY,
    ACTIVE_RUN_LOCK_TTL_SECONDS,
    QUEUE_NAME,
    REDIS_URL_ENV,
)


def redis_url() -> str:
    return os.getenv(REDIS_URL_ENV, "redis://localhost:6379/0")


def get_redis_connection() -> Redis:
    return Redis.from_url(redis_url())


def get_queue(connection: Redis | None = None) -> Queue:
    conn = connection or get_redis_connection()
    return Queue(QUEUE_NAME, connection=conn)


def get_active_run_id(connection: Redis | None = None) -> str | None:
    conn = connection or get_redis_connection()
    value = conn.get(ACTIVE_RUN_LOCK_KEY)
    if isinstance(value, bytes):
        return value.decode("utf-8")
    return value


def acquire_active_run_lock(run_id: str, connection: Redis | None = None) -> bool:
    conn = connection or get_redis_connection()
    return bool(
        conn.set(
            ACTIVE_RUN_LOCK_KEY,
            run_id,
            ex=ACTIVE_RUN_LOCK_TTL_SECONDS,
            nx=True,
        )
    )


def release_active_run_lock(run_id: str, connection: Redis | None = None) -> None:
    conn = connection or get_redis_connection()
    current = get_active_run_id(conn)
    if current == run_id:
        conn.delete(ACTIVE_RUN_LOCK_KEY)
