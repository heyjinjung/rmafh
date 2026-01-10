import os
import sys
from pathlib import Path

import psycopg2
import pytest
from fastapi.testclient import TestClient
from psycopg2 import OperationalError

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


def _with_connect_timeout(url: str, seconds: int = 3) -> str:
    # For libpq/psycopg2, connect_timeout can be specified as a URI query param.
    if "connect_timeout=" in url:
        return url
    joiner = "&" if "?" in url else "?"
    return f"{url}{joiner}connect_timeout={seconds}"


@pytest.fixture(scope="session")
def db_url():
    """Database URL for tests.

    - If DATABASE_URL is set, always respect it.
    - If running inside Docker, default to the compose service host `db`.
    - Otherwise (local machine), default to `localhost` (compose publishes 5432).
    
    NOTE: Tests use a separate database 'vault_test' to avoid destroying dev data.
    """
    env_url = os.getenv("DATABASE_URL")
    if env_url:
        # Replace database name with vault_test for isolation
        if "/vault" in env_url and "/vault_test" not in env_url:
            env_url = env_url.replace("/vault", "/vault_test")
        return _with_connect_timeout(env_url)
    host = "db" if _running_in_docker() else "localhost"
    return _with_connect_timeout(f"postgresql://vault:vaultpass@{host}:5432/vault_test")


@pytest.fixture(scope="session")
def db_conn(db_url):
    try:
        conn = psycopg2.connect(db_url, connect_timeout=3, application_name="pytest-db")
    except OperationalError as exc:  # pragma: no cover - skip if DB unavailable
        pytest.skip(f"database not reachable: {exc}")
    yield conn
    conn.close()


@pytest.fixture(scope="session", autouse=True)
def _ensure_test_schema(db_url):
    """Ensure required tables exist for tests.

    In tests we set APP_ENV=test, so the app startup does not run best-effort DDL.
    The suite assumes a prepared DB, but we still defensively create any tables
    that tests rely on.
    """
    try:
        conn = psycopg2.connect(db_url, connect_timeout=3, application_name="pytest-schema")
    except OperationalError as exc:  # pragma: no cover - skip if DB unavailable
        pytest.skip(f"database not reachable: {exc}")

    conn.autocommit = True
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                CREATE TABLE IF NOT EXISTS notification_templates (
                  id BIGSERIAL PRIMARY KEY,
                  type VARCHAR(32) NOT NULL UNIQUE,
                  title VARCHAR(128) NOT NULL,
                  body TEXT NOT NULL,
                  cta_text VARCHAR(64),
                  icon_emoji VARCHAR(8),
                  category VARCHAR(32),
                  priority INT DEFAULT 0,
                  enabled BOOLEAN DEFAULT TRUE,
                  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                );
                """
            )
            cur.execute(
                "CREATE INDEX IF NOT EXISTS idx_notification_templates_enabled ON notification_templates (enabled)"
            )
            cur.execute(
                "CREATE INDEX IF NOT EXISTS idx_notification_templates_priority ON notification_templates (priority DESC)"
            )
    finally:
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
    
    IMPORTANT: This only runs when APP_ENV=test to prevent accidental deletion
    of production/development data.
    """
    # Skip DB reset if not in test environment to protect real data
    if os.getenv("APP_ENV") != "test":
        yield
        return
        
    try:
        conn = psycopg2.connect(db_url, connect_timeout=3)
    except OperationalError:  # pragma: no cover
        yield
        return

    conn.autocommit = True
    try:
        with conn.cursor() as cur:
            # Use DELETE instead of TRUNCATE to avoid lock contention with app pool connections.
            cur.execute("DELETE FROM notifications_queue")
            cur.execute("DELETE FROM compensation_queue")
            cur.execute("DELETE FROM admin_job_items")
            cur.execute("DELETE FROM admin_jobs")
            cur.execute("DELETE FROM admin_audit_log")
            cur.execute("DELETE FROM idempotency_keys")
            cur.execute("DELETE FROM vault_expiry_extension_log")
            cur.execute("DELETE FROM user_admin_snapshot")
            cur.execute("DELETE FROM vault_status")
            cur.execute("DELETE FROM user_identity")
            # Reset sequences manually since DELETE doesn't auto-restart them
            cur.execute("ALTER SEQUENCE user_identity_user_id_seq RESTART WITH 1")
            cur.execute("ALTER SEQUENCE notifications_queue_id_seq RESTART WITH 1")
            cur.execute("ALTER SEQUENCE compensation_queue_id_seq RESTART WITH 1")
            cur.execute("ALTER SEQUENCE vault_expiry_extension_log_id_seq RESTART WITH 1")
            cur.execute("ALTER SEQUENCE admin_job_items_id_seq RESTART WITH 1")
    except psycopg2.Error as exc:  # pragma: no cover
        conn.close()
        pytest.skip(f"database reset skipped (DB busy/locked): {exc}")
    conn.close()
    yield
