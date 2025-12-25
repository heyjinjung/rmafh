from datetime import datetime, timezone
from uuid import uuid4


def _idem_headers():
    return {"x-idempotency-key": f"test-admin-import-{uuid4()}"}


def _import_user(client, external_user_id: str):
    body = {
        "rows": [
            {
                "external_user_id": external_user_id,
                "nickname": "user",
                "deposit_total": 0,
                "telegram_ok": True,
                "last_deposit_at": "2025-12-20",
            }
        ]
    }
    resp = client.post("/api/vault/user-daily-import", json=body, headers=_idem_headers())
    if resp.status_code != 200:
        raise AssertionError(f"import failed: {resp.status_code} {resp.json()}")


def test_admin_job_idempotency_replay(client):
    headers = {"x-idempotency-key": "idem-job-1"}
    body = {"type": "EXTEND_EXPIRY", "target": {"user_ids": [101]}}

    first = client.post("/api/vault/admin/jobs", json=body, headers=headers)
    assert first.status_code == 202
    job_id = first.json()["job_id"]
    assert first.headers.get("Idempotency-Status") == "recorded"

    second = client.post("/api/vault/admin/jobs", json=body, headers=headers)
    assert second.status_code == 202
    assert second.headers.get("Idempotency-Status") == "replayed"
    assert second.json()["job_id"] == job_id


def test_admin_job_idempotency_conflict_on_payload_mismatch(client):
    headers = {"x-idempotency-key": "idem-job-2"}
    body_one = {"type": "EXTEND_EXPIRY", "target": {"user_ids": [201]}}
    body_two = {"type": "NOTIFY", "target": {"user_ids": [201]}}

    first = client.post("/api/vault/admin/jobs", json=body_one, headers=headers)
    assert first.status_code == 202

    conflict = client.post("/api/vault/admin/jobs", json=body_two, headers=headers)
    assert conflict.status_code == 409
    assert conflict.json().get("detail") == "IDEMPOTENCY_KEY_REUSE"


def test_admin_job_retry_resets_failed_items(client, db_conn):
    headers = {"x-idempotency-key": "idem-job-3"}
    body = {"type": "NOTIFY", "target": {"user_ids": [301, 302]}, "payload": {"foo": "bar"}}

    created = client.post("/api/vault/admin/jobs", json=body, headers=headers)
    assert created.status_code == 202
    job_id = created.json()["job_id"]

    cur = db_conn.cursor()
    cur.execute(
        """
        UPDATE admin_jobs
           SET status='FAILED', processed=1, failed=1
         WHERE job_id=%s
        """,
        (job_id,),
    )
    cur.execute(
        """
        UPDATE admin_job_items
           SET status='FAILED', error_message='boom'
         WHERE job_id=%s
        """,
        (job_id,),
    )
    db_conn.commit()

    retried = client.post(f"/api/vault/admin/jobs/{job_id}/retry")
    assert retried.status_code == 200
    data = retried.json()
    assert data["status"] == "PENDING"

    items = client.get(f"/api/vault/admin/jobs/{job_id}/items").json()
    for item in items.get("items", []):
        assert item["status"] == "PENDING"
        assert item.get("error_message") in (None, "")


def test_extend_expiry_shadow_and_apply(client):
    external_user_id = "ext-extend-1"
    _import_user(client, external_user_id)

    shadow_req = {
        "request_id": "req-extend-shadow-1",
        "scope": "USER_IDS",
        "external_user_ids": [external_user_id],
        "extend_hours": 6,
        "reason": "OPS",
        "shadow": True,
    }
    shadow_resp = client.post("/api/vault/extend-expiry", json=shadow_req)
    if shadow_resp.status_code != 200:
        # aid debugging when validation fails
        raise AssertionError(f"shadow failed: {shadow_resp.status_code} {shadow_resp.json()}")
    shadow_body = shadow_resp.json()
    assert shadow_body["shadow"] is True
    assert shadow_body.get("candidates", 0) >= 1
    assert shadow_resp.headers.get("Idempotency-Status") == "recorded"

    status_before = client.get("/api/vault/status", params={"external_user_id": external_user_id}).json()
    old_expires = datetime.fromisoformat(status_before["expires_at"])

    apply_req = dict(shadow_req)
    apply_req["request_id"] = "req-extend-apply-1"
    apply_req["shadow"] = False
    apply_req["extend_hours"] = 4

    apply_resp = client.post("/api/vault/extend-expiry", json=apply_req)
    if apply_resp.status_code != 200:
        raise AssertionError(f"apply failed: {apply_resp.status_code} {apply_resp.json()}")
    apply_body = apply_resp.json()
    new_expires = datetime.fromisoformat(apply_body["new_expires_at"])
    assert new_expires > old_expires
    assert apply_resp.headers.get("Idempotency-Status") == "recorded"

    status_after = client.get("/api/vault/status", params={"external_user_id": external_user_id}).json()
    assert datetime.fromisoformat(status_after["expires_at"]) == new_expires


def test_notify_idempotency_replay(client, db_conn):
    external_user_id = "ext-notify-1"
    _import_user(client, external_user_id)

    headers = {"x-idempotency-key": "notify-idem-1"}
    body = {"type": "EXPIRY_D2", "external_user_ids": [external_user_id], "variant_id": "A"}

    first = client.post("/api/vault/notify", json=body, headers=headers)
    assert first.status_code == 200
    assert first.headers.get("Idempotency-Status") == "recorded"
    assert first.json().get("enqueued") == 1

    second = client.post("/api/vault/notify", json=body, headers=headers)
    assert second.status_code == 200
    assert second.headers.get("Idempotency-Status") == "replayed"
    assert second.json().get("enqueued") == 1

    cur = db_conn.cursor()
    cur.execute("SELECT COUNT(*) FROM notifications_queue WHERE type='EXPIRY_D2'")
    assert cur.fetchone()[0] == 1
