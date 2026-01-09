from uuid import uuid4

def _idem_headers(prefix: str):
    return {"x-idempotency-key": f"{prefix}-{uuid4()}"}

def test_platinum_missions_unlock_status(client):
    ext_id = f"ext-plat-logic-{uuid4()}"
    create = client.post(
        "/api/vault/admin/users",
        json={
            "external_user_id": ext_id,
            "nickname": "plat_logic",
            "joined_date": "2024-01-01",
            "deposit_total": 0,
            "telegram_ok": True,
            "review_ok": True,
        },
        headers=_idem_headers("create"),
    )
    assert create.status_code == 200
    user_id = create.json()["user_id"]

    client.post(
        f"/api/vault/admin/users/{user_id}/vault/attendance",
        json={"set_days": 3},
        headers=_idem_headers("att"),
    )
    
    r1 = client.post(
        f"/api/vault/admin/users/{user_id}/vault/platinum-missions",
        json={"platinum_mission_1_done": True, "platinum_mission_2_done": True},
        headers=_idem_headers("plat-m"),
    )
    assert r1.status_code == 200
    assert r1.json()["platinum_status"] == "LOCKED"

def test_diamond_missions_unlock_status(client):
    ext_id = f"ext-dia-logic-{uuid4()}"
    create = client.post(
        "/api/vault/admin/users",
        json={
            "external_user_id": ext_id,
            "nickname": "dia_logic",
            "joined_date": "2024-01-01",
            "deposit_total": 0,
            "telegram_ok": True,
            "review_ok": True,
        },
        headers=_idem_headers("create"),
    )
    assert create.status_code == 200
    user_id = create.json()["user_id"]

    r1 = client.post(
        f"/api/vault/admin/users/{user_id}/vault/diamond-missions",
        json={"diamond_mission_1_done": True, "diamond_mission_2_done": True},
        headers=_idem_headers("dia-m"),
    )
    assert r1.status_code == 200
    assert r1.json()["diamond_status"] == "LOCKED"
