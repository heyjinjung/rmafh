import contextlib
import psycopg2
from psycopg2 import pool
from app import config

_connection_pool: pool.SimpleConnectionPool | None = None


def init_pool():
    global _connection_pool
    if _connection_pool is None:
        _connection_pool = psycopg2.pool.SimpleConnectionPool(
            minconn=1,
            maxconn=5,
            dsn=config.DATABASE_URL,
        )
    return _connection_pool


def close_pool():
    global _connection_pool
    if _connection_pool:
        _connection_pool.closeall()
        _connection_pool = None


@contextlib.contextmanager
def get_conn():
    if _connection_pool is None:
        raise RuntimeError("DB pool not initialized")
    conn = _connection_pool.getconn()
    try:
        yield conn
    finally:
        # Ensure no transaction remains open; pending locks can block tests/truncates.
        try:
            conn.rollback()
        except Exception:
            pass
        _connection_pool.putconn(conn)
