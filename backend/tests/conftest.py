import os

import psycopg2
import pytest
from fastapi.testclient import TestClient


@pytest.fixture(scope="session")
def db_url():
    return os.getenv("DATABASE_URL", "postgresql://vault:vaultpass@localhost:5432/vault")


@pytest.fixture(scope="session")
def db_conn(db_url):
    try:
        conn = psycopg2.connect(db_url)
    except psycopg2.OperationalError as exc:  # pragma: no cover - skip if DB unavailable
        pytest.skip(f"database not reachable: {exc}")
    yield conn
    conn.close()


@pytest.fixture(scope="session")
def client(db_url):
    os.environ["DATABASE_URL"] = db_url
    os.environ.setdefault("APP_ENV", "test")
    from app.main import app

    with TestClient(app) as c:
        yield c
