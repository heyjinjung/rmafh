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
