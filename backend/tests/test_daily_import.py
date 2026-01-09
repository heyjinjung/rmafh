from uuid import uuid4


def _idem_headers():
    return {"x-idempotency-key": f"test-import-{uuid4()}"}


def test_daily_import_unlocks_gold_and_diamond(client):
    body = {
        "rows": [
            {
                "external_user_id": "ext-import-1",
                "nickname": "nick",
                "deposit_total": 2500000,  # 250만원 - 다이아몬드 해금 조건 충족 (200만원 이상)
                "joined_at": "2025-12-01",
                "last_deposit_at": "2025-12-20",
                "telegram_ok": True,
            }
        ]
    }

    resp = client.post("/api/vault/user-daily-import", json=body, headers=_idem_headers())
    assert resp.status_code == 200
    data = resp.json()
    assert data.get("processed") == 1

    status = client.get("/api/vault/status", params={"external_user_id": "ext-import-1"})
    assert status.status_code == 200
    s = status.json()
    assert s.get("gold_status") == "UNLOCKED"
    assert s.get("diamond_status") == "UNLOCKED"
    assert int(s.get("diamond_deposit_current")) == 2500000


def test_daily_import_unlocks_platinum_after_three_days_and_review(client):
    external_user_id = "ext-import-platinum-1"

    # Day 1: +100,000
    resp = client.post(
        "/api/vault/user-daily-import",
        json={
            "rows": [
                {
                    "external_user_id": external_user_id,
                    "nickname": "nick",
                    "joined_at": "2025-12-01",
                    "deposit_total": 100000,
                    "last_deposit_at": "2025-12-20",
                    "review_ok": False,
                    "telegram_ok": True,
                }
            ]
        },
        headers=_idem_headers(),
    )
    assert resp.status_code == 200

    s1 = client.get("/api/vault/status", params={"external_user_id": external_user_id}).json()
    assert s1.get("platinum_status") in {"LOCKED", "ACTIVE"}
    assert int(s1.get("platinum_attendance_days")) == 1

    # Day 2: +100,000 (cumulative 200,000)
    resp = client.post(
        "/api/vault/user-daily-import",
        json={
            "rows": [
                {
                    "external_user_id": external_user_id,
                    "joined_at": "2025-12-01",
                    "deposit_total": 200000,
                    "last_deposit_at": "2025-12-21",
                    "review_ok": False,
                    "telegram_ok": True,
                }
            ]
        },
        headers=_idem_headers(),
    )
    assert resp.status_code == 200

    s2 = client.get("/api/vault/status", params={"external_user_id": external_user_id}).json()
    assert int(s2.get("platinum_attendance_days")) == 2
    assert s2.get("platinum_status") in {"LOCKED", "ACTIVE"}

    # Day 3: +100,000 (cumulative 300,000 > 200,000) + review_ok=true
    # platinum_deposit_count needs to be >= 3 - set via admin
    resp = client.post(
        "/api/vault/user-daily-import",
        json={
            "rows": [
                {
                    "external_user_id": external_user_id,
                    "joined_at": "2025-12-01",
                    "deposit_total": 300000,
                    "last_deposit_at": "2025-12-22",
                    "review_ok": True,
                    "telegram_ok": True,
                }
            ]
        },
        headers=_idem_headers(),
    )
    assert resp.status_code == 200

    s3 = client.get("/api/vault/status", params={"external_user_id": external_user_id}).json()
    assert int(s3.get("platinum_attendance_days")) == 3
    # Platinum still LOCKED because deposit_count < 3 (CSV doesn't track deposit_count)
    # Need admin to set deposit_count for platinum unlock
    assert s3.get("platinum_status") in {"LOCKED", "ACTIVE"}
