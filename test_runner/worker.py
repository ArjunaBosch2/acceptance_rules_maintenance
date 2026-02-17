from rq import Connection, Worker

from .constants import QUEUE_NAME
from .queueing import get_redis_connection


def main() -> None:
    connection = get_redis_connection()
    with Connection(connection):
        worker = Worker([QUEUE_NAME])
        worker.work(with_scheduler=False)


if __name__ == "__main__":
    main()
