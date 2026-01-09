from uuid import uuid4


def _idem_headers(prefix: str = "test-gold-missions"):
    return {"x-idempotency-key": f"{prefix}-{uuid4()}"}


def test_gold_missions_toggle_updates_status(client):
    # Create user with minimal flags so gold starts LOCKED.
    create = client.post(
        "/api/vault/admin/users",
        json={
            "external_user_id": f"ext-gm-{uuid4()}",
            "nickname": "gm",
            "joined_date": "2024-01-01",
            "deposit_total": 0,
            "telegram_ok": False,
            "review_ok": False,
        },
        headers=_idem_headers("create"),
    )
    assert create.status_code == 200
    user_id = create.json()["user_id"]

    r1 = client.post(
        f"/api/vault/admin/users/{user_id}/vault/gold-missions",
        json={"gold_mission_1_done": True},
        headers=_idem_headers("m1"),
    )
    assert r1.status_code == 200
    assert r1.headers.get("Idempotency-Status") == "recorded"
    d1 = r1.json()
    assert d1["gold_mission_1_done"] is True
    assert d1["gold_mission_2_done"] is False
    assert d1["gold_mission_3_done"] is False
    assert d1["gold_status"] == "LOCKED"

    r2 = client.post(
        f"/api/vault/admin/users/{user_id}/vault/gold-missions",
        json={"gold_mission_2_done": True},
        headers=_idem_headers("m2"),
    )
    assert r2.status_code == 200
    d2 = r2.json()
    assert d2["gold_mission_1_done"] is True
    assert d2["gold_mission_2_done"] is True
    assert d2["gold_mission_3_done"] is False
    assert d2["gold_status"] == "LOCKED"

    r3 = client.post(
        f"/api/vault/admin/users/{user_id}/vault/gold-missions",
        json={"gold_mission_3_done": True},
        headers=_idem_headers("m3"),
    )
    assert r3.status_code == 200
    d3 = r3.json()
    assert d3["gold_mission_1_done"] is True
    assert d3["gold_mission_2_done"] is True
    assert d3["gold_mission_3_done"] is True
    assert d3["gold_status"] == "UNLOCKED"


def test_gold_missions_does_not_override_claimed_status(client):
    create = client.post(
        "/api/vault/admin/users",
        json={
            "external_user_id": f"ext-gm-claimed-{uuid4()}",
            "nickname": "gm",
            "joined_date": "2024-01-01",
            "deposit_total": 0,
            "telegram_ok": False,
            "review_ok": False,
        },
        headers=_idem_headers("create-claimed"),
    )
    assert create.status_code == 200
    user_id = create.json()["user_id"]

    claim = client.post(
        f"/api/vault/admin/users/{user_id}/vault/status",
        json={"gold_status": "CLAIMED"},
        headers=_idem_headers("status-claimed"),
    )
    assert claim.status_code == 200
    assert claim.json()["gold_status"] == "CLAIMED"

    missions = client.post(
        f"/api/vault/admin/users/{user_id}/vault/gold-missions",
        json={
            "gold_mission_1_done": True,
            "gold_mission_2_done": True,
            "gold_mission_3_done": True,
        },
        headers=_idem_headers("missions-after-claimed"),
    )
    assert missions.status_code == 200
    data = missions.json()
    assert data["gold_mission_1_done"] is True
    assert data["gold_mission_2_done"] is True
    assert data["gold_mission_3_done"] is True
    # Policy: do not automatically change CLAIMED/EXPIRED status
    assert data["gold_status"] == "CLAIMED"


def test_gold_missions_idempotency_replay(client):
    create = client.post(
        "/api/vault/admin/users",
        json={
            "external_user_id": f"ext-gm-idem-{uuid4()}",
            "nickname": "gm",
            "joined_date": "2024-01-01",
            "deposit_total": 0,
            "telegram_ok": False,
            "review_ok": False,
        },
        headers=_idem_headers("create-idem"),
    )
    assert create.status_code == 200
    user_id = create.json()["user_id"]

    idem_key = f"gold-missions-replay-{uuid4()}"
    headers = {"x-idempotency-key": idem_key}

    first = client.post(
        f"/api/vault/admin/users/{user_id}/vault/gold-missions",
        json={"gold_mission_1_done": True},
        headers=headers,
    )
    assert first.status_code == 200
    assert first.headers.get("Idempotency-Status") == "recorded"

    second = client.post(
        f"/api/vault/admin/users/{user_id}/vault/gold-missions",
        json={"gold_mission_1_done": True},
        headers=headers,
    )
    assert second.status_code == 200
    assert second.headers.get("Idempotency-Status") == "replayed"
    assert second.json() == first.json()
