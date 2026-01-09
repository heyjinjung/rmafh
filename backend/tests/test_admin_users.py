from datetime import datetime, date, timedelta, timezone
from uuid import uuid4


def _idem_headers(prefix: str = "test-admin-user"):
    return {"x-idempotency-key": f"{prefix}-{uuid4()}"}


def _seed_user(cur, user_id, external_user_id, nickname, gold_status, expires_at, deposit_total, joined_date):
    cur.execute(
        """
        INSERT INTO user_identity (user_id, external_user_id, created_at)
        VALUES (%s, %s, NOW())
        ON CONFLICT (external_user_id) DO UPDATE SET user_id = EXCLUDED.user_id
        """,
        (user_id, external_user_id),
    )

    cur.execute(
        """
        INSERT INTO vault_status (
            user_id, expires_at, gold_status, platinum_status, diamond_status,
            platinum_attendance_days, platinum_deposit_done, diamond_deposit_current
        )
        VALUES (%s, %s, %s, 'LOCKED', 'LOCKED', 0, FALSE, %s)
        ON CONFLICT (user_id) DO UPDATE
        SET expires_at = EXCLUDED.expires_at,
            gold_status = EXCLUDED.gold_status,
            platinum_status = EXCLUDED.platinum_status,
            diamond_status = EXCLUDED.diamond_status,
            platinum_attendance_days = EXCLUDED.platinum_attendance_days,
            diamond_deposit_current = EXCLUDED.diamond_deposit_current
        """,
        (user_id, expires_at, gold_status, deposit_total),
    )

    cur.execute(
        """
        INSERT INTO user_admin_snapshot (user_id, nickname, joined_date, deposit_total, telegram_ok, review_ok)
        VALUES (%s, %s, %s, %s, FALSE, FALSE)
        ON CONFLICT (user_id) DO UPDATE
        SET nickname = EXCLUDED.nickname,
            joined_date = EXCLUDED.joined_date,
            deposit_total = EXCLUDED.deposit_total,
            telegram_ok = EXCLUDED.telegram_ok,
            review_ok = EXCLUDED.review_ok
        """,
        (user_id, nickname, joined_date, deposit_total),
    )


def test_admin_users_pagination_sort_and_filter(client, db_conn):
    cur = db_conn.cursor()
    now = datetime.now(timezone.utc)

    _seed_user(
        cur,
        user_id=1,
        external_user_id="ext-1",
        nickname="Alpha",
        gold_status="LOCKED",
        expires_at=now + timedelta(days=3),
        deposit_total=1_000,
        joined_date=date(2024, 1, 1),
    )
    _seed_user(
        cur,
        user_id=2,
        external_user_id="ext-2",
        nickname="Bravo",
        gold_status="UNLOCKED",
        expires_at=now + timedelta(days=2),
        deposit_total=5_000,
        joined_date=date(2024, 1, 2),
    )
    _seed_user(
        cur,
        user_id=3,
        external_user_id="ext-3",
        nickname="Charlie",
        gold_status="EXPIRED",
        expires_at=now - timedelta(days=1),
        deposit_total=200,
        joined_date=date(2023, 12, 31),
    )
    db_conn.commit()

    resp = client.get("/api/vault/admin/users", params={
        "sort_by": "deposit_total",
        "sort_dir": "desc",
        "page": 1,
        "page_size": 2,
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data.get("total") == 3
    assert len(data.get("users", [])) == 2
    assert [u.get("external_user_id") for u in data["users"]] == ["ext-2", "ext-1"]

    resp_page2 = client.get("/api/vault/admin/users", params={
        "sort_by": "deposit_total",
        "sort_dir": "desc",
        "page": 2,
        "page_size": 2,
    })
    assert resp_page2.status_code == 200
    data_page2 = resp_page2.json()
    assert len(data_page2.get("users", [])) == 1
    assert data_page2["users"][0].get("external_user_id") == "ext-3"

    resp_filtered = client.get("/api/vault/admin/users", params={
        "status": "LOCKED",
        "sort_by": "external_user_id",
        "sort_dir": "asc",
    })
    assert resp_filtered.status_code == 200
    filtered = resp_filtered.json()
    assert filtered.get("total") == 1
    assert filtered["users"][0].get("external_user_id") == "ext-1"


def test_admin_user_bulk_updates_apply(client):
    # Create two users via admin API with idempotency
    users = []
    for ext in ("ext-bulk-1", "ext-bulk-2"):
        resp = client.post(
            "/api/vault/admin/users",
            json={
                "external_user_id": ext,
                "nickname": ext,
                "joined_date": "2024-01-01",
                "deposit_total": 0,
                "telegram_ok": True,
                "review_ok": True,
            },
            headers=_idem_headers(f"create-{ext}"),
        )
        assert resp.status_code == 200
        users.append((resp.json()["user_id"], ext))

    for user_id, ext in users:
        deposit = client.post(
            f"/api/vault/admin/users/{user_id}/vault/deposit",
            json={"platinum_deposit_total": 100000, "platinum_deposit_count": 3, "diamond_deposit_total": 600000},
            headers=_idem_headers(f"deposit-{ext}"),
        )
        assert deposit.status_code == 200

        attendance = client.post(
            f"/api/vault/admin/users/{user_id}/vault/attendance",
            json={"set_days": 3},
            headers=_idem_headers(f"attendance-{ext}"),
        )
        assert attendance.status_code == 200

        status = client.get("/api/vault/status", params={"external_user_id": ext})
        assert status.status_code == 200
        data = status.json()
        assert data["gold_status"] == "UNLOCKED"
        assert data["platinum_status"] == "UNLOCKED"
        assert data["diamond_status"] == "UNLOCKED"
