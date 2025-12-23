def test_daily_import_unlocks_gold_and_diamond(client):
    body = {
        "rows": [
            {
                "external_user_id": "ext-import-1",
                "nickname": "nick",
                "deposit_total": 500000,
                "joined_at": "2025-12-01",
                "last_deposit_at": "2025-12-20",
                "telegram_ok": True,
            }
        ]
    }

    resp = client.post("/api/vault/user-daily-import", json=body)
    assert resp.status_code == 200
    data = resp.json()
    assert data.get("processed") == 1

    status = client.get("/api/vault/status", params={"external_user_id": "ext-import-1"})
    assert status.status_code == 200
    s = status.json()
    assert s.get("gold_status") == "UNLOCKED"
    assert s.get("diamond_status") == "UNLOCKED"
    assert int(s.get("diamond_deposit_current")) == 500000


def test_daily_import_unlocks_platinum_after_three_days_and_review(client):
    external_user_id = "ext-import-platinum-1"

    # Day 1: +50,000
    resp = client.post(
        "/api/vault/user-daily-import",
        json={
            "rows": [
                {
                    "external_user_id": external_user_id,
                    "nickname": "nick",
                    "joined_at": "2025-12-01",
                    "deposit_total": 50000,
                    "last_deposit_at": "2025-12-20",
                    "review_ok": False,
                }
            ]
        },
    )
    assert resp.status_code == 200

    s1 = client.get("/api/vault/status", params={"external_user_id": external_user_id}).json()
    assert s1.get("platinum_status") in {"LOCKED", "ACTIVE"}
    assert int(s1.get("platinum_attendance_days")) == 1

    # Day 2: +50,000 (cumulative 100,000)
    resp = client.post(
        "/api/vault/user-daily-import",
        json={
            "rows": [
                {
                    "external_user_id": external_user_id,
                    "joined_at": "2025-12-01",
                    "deposit_total": 100000,
                    "last_deposit_at": "2025-12-21",
                    "review_ok": False,
                }
            ]
        },
    )
    assert resp.status_code == 200

    s2 = client.get("/api/vault/status", params={"external_user_id": external_user_id}).json()
    assert int(s2.get("platinum_attendance_days")) == 2
    assert s2.get("platinum_status") in {"LOCKED", "ACTIVE"}

    # Day 3: +50,000 (cumulative 150,000) + review_ok=true
    resp = client.post(
        "/api/vault/user-daily-import",
        json={
            "rows": [
                {
                    "external_user_id": external_user_id,
                    "joined_at": "2025-12-01",
                    "deposit_total": 150000,
                    "last_deposit_at": "2025-12-22",
                    "review_ok": True,
                }
            ]
        },
    )
    assert resp.status_code == 200

    s3 = client.get("/api/vault/status", params={"external_user_id": external_user_id}).json()
    assert int(s3.get("platinum_attendance_days")) == 3
    assert s3.get("platinum_status") == "UNLOCKED"
