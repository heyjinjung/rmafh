import os
import sys
from pathlib import Path

import psycopg2
import pytest
from fastapi.testclient import TestClient

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))


def _running_in_docker() -> bool:
    # Common indicator inside Linux containers.
    if os.path.exists("/.dockerenv"):
        return True
    # Fallback heuristic for some container runtimes.
    cgroup_path = "/proc/1/cgroup"
    if os.path.exists(cgroup_path):
        try:
            with open(cgroup_path, "r", encoding="utf-8") as f:
                content = f.read()
            return "docker" in content or "containerd" in content
        except OSError:
            return False
    return False


@pytest.fixture(scope="session")
def db_url():
    """Database URL for tests.

    - If DATABASE_URL is set, always respect it.
    - If running inside Docker, default to the compose service host `db`.
    - Otherwise (local machine), default to `localhost` (compose publishes 5432).
    """
    env_url = os.getenv("DATABASE_URL")
    if env_url:
        return env_url
    host = "db" if _running_in_docker() else "localhost"
    return f"postgresql://vault:vaultpass@{host}:5432/vault"


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
    os.environ["APP_ENV"] = "test"
    from app.main import app

    with TestClient(app) as c:
        yield c


@pytest.fixture(autouse=True)
def _reset_db_state(db_url):
    """Ensure tests are repeatable by resetting persistent DB state.

    The test suite uses a real Postgres and a session-scoped client, so
    without cleanup, re-running tests can be affected by previous data.
    """
    try:
        conn = psycopg2.connect(db_url)
    except psycopg2.OperationalError:  # pragma: no cover
        yield
        return

    conn.autocommit = True
    with conn.cursor() as cur:
        cur.execute(
            """
            TRUNCATE TABLE
                notifications_queue,
                compensation_queue,
                vault_expiry_extension_log,
                user_admin_snapshot,
                vault_status,
                user_identity
            RESTART IDENTITY
            """
        )
    conn.close()
    yield
