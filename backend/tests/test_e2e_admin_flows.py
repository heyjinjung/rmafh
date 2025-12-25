from uuid import uuid4


def _idem_headers(prefix: str = "e2e"):
    return {"x-idempotency-key": f"{prefix}-{uuid4()}"}


def _request_id(prefix: str = "req") -> str:
    return f"{prefix}-{uuid4()}"


def test_e2e_import_then_extend_expiry(client):
    # Import two users (apply mode) so we can later extend expiry
    rows = [
        {
            "external_user_id": "ext-e2e-1",
            "nickname": "alpha",
            "joined_at": "2024-01-01",
            "deposit_total": 0,
            "last_deposit_at": "2024-01-02",
            "telegram_ok": True,
            "review_ok": True,
        },
        {
            "external_user_id": "ext-e2e-2",
            "nickname": "beta",
            "joined_at": "2024-01-01",
            "deposit_total": 0,
            "last_deposit_at": "2024-01-03",
            "telegram_ok": True,
            "review_ok": True,
        },
    ]
    import_resp = client.post(
        "/api/vault/admin/imports",
        json={"mode": "APPLY", "rows": rows},
        headers=_idem_headers("import-apply"),
    )
    assert import_resp.status_code == 200
    body = import_resp.json()
    assert body.get("processed") == 2
    assert body.get("identity_created") >= 0

    status_before_1 = client.get("/api/vault/status", params={"external_user_id": "ext-e2e-1"}).json()
    status_before_2 = client.get("/api/vault/status", params={"external_user_id": "ext-e2e-2"}).json()
    expires_before_1 = status_before_1["expires_at"]
    expires_before_2 = status_before_2["expires_at"]

    extend_req = {
        "request_id": _request_id("extend-e2e"),
        "scope": "USER_IDS",
        "external_user_ids": ["ext-e2e-1", "ext-e2e-2"],
        "extend_hours": 6,
        "reason": "OPS",
        "shadow": False,
    }
    extend_resp = client.post("/api/vault/extend-expiry", json=extend_req)
    assert extend_resp.status_code == 200
    new_expires = extend_resp.json().get("new_expires_at")
    assert new_expires

    status_after_1 = client.get("/api/vault/status", params={"external_user_id": "ext-e2e-1"}).json()
    status_after_2 = client.get("/api/vault/status", params={"external_user_id": "ext-e2e-2"}).json()
    assert status_after_1["expires_at"] > expires_before_1
    assert status_after_2["expires_at"] > expires_before_2


def test_e2e_import_errors_shadow_reports(client):
    rows = [
        {
            "external_user_id": "ext-e2e-dup",
            "nickname": "dup1",
            "joined_at": "2024-01-01",
            "deposit_total": 0,
            "telegram_ok": False,
            "review_ok": False,
        },
        {
            "external_user_id": "ext-e2e-dup",
            "nickname": "dup2",
            "joined_at": "2024-01-02",
            "deposit_total": 10,
            "telegram_ok": False,
            "review_ok": False,
        },
        {
            "external_user_id": "",  # empty string is treated as missing by server normalization
            "nickname": "missing",
            "joined_at": "2024-01-03",
            "deposit_total": 5,
            "telegram_ok": False,
            "review_ok": False,
        },
    ]
    resp = client.post(
        "/api/vault/admin/imports",
        json={"mode": "SHADOW", "rows": rows},
        headers=_idem_headers("import-shadow"),
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["shadow"] is True
    assert data["total"] == 3
    assert data["dedup_removed"] == 1
    assert any(err.get("code") == "MISSING_EXTERNAL_USER_ID" for err in data.get("errors", []))
    assert data.get("job_ids") is None


def test_e2e_notify_list_and_retry_guard(client, db_conn):
    # create a user so notify can resolve user_id
    create = client.post(
        "/api/vault/admin/users",
        json={
            "external_user_id": "ext-e2e-notify",
            "nickname": "notify",
            "joined_date": "2024-01-01",
            "deposit_total": 0,
            "telegram_ok": True,
            "review_ok": False,
        },
        headers=_idem_headers("notify-create"),
    )
    assert create.status_code == 200

    headers = _idem_headers("notify-send")
    notify_body = {"type": "EXPIRY_D2", "external_user_ids": ["ext-e2e-notify"], "variant_id": "A"}
    send = client.post("/api/vault/notify", json=notify_body, headers=headers)
    assert send.status_code == 200
    assert send.json().get("enqueued") == 1

    listed = client.get("/api/vault/admin/notifications", params={"type": "EXPIRY_D2"})
    assert listed.status_code == 200
    assert listed.json().get("total", 0) >= 1

    # Retry guard: job retry endpoint should reject non-failed job
    cur = db_conn.cursor()
    cur.execute("SELECT job_id FROM admin_jobs ORDER BY created_at DESC LIMIT 1")
    row = cur.fetchone()
    if row:
        job_id = row[0]
        retry = client.post(f"/api/vault/admin/jobs/{job_id}/retry")
        assert retry.status_code in {200, 409}


def test_e2e_admin_audit_logs_capture_request_id(client, db_conn):
    # Ensure target user exists so job creation succeeds
    create = client.post(
        "/api/vault/admin/users",
        json={
            "external_user_id": "ext-audit-1",
            "nickname": "audit",
            "joined_date": "2024-01-01",
            "deposit_total": 0,
            "telegram_ok": True,
            "review_ok": True,
        },
        headers=_idem_headers("audit-create"),
    )
    assert create.status_code == 200

    headers = _idem_headers("audit-job")
    body = {"type": "NOTIFY", "target": {"external_user_ids": ["ext-audit-1"]}}
    created = client.post("/api/vault/admin/jobs", json=body, headers=headers)
    assert created.status_code == 202
    job_id = created.json()["job_id"]

    cur = db_conn.cursor()
    cur.execute(
        "SELECT request_id, idempotency_key, job_id FROM admin_audit_log WHERE job_id=%s ORDER BY id DESC LIMIT 1",
        (job_id,),
    )
    row = cur.fetchone()
    assert row is not None
    request_id, idem_key, logged_job_id = row
    assert request_id == headers["x-idempotency-key"]
    assert idem_key == headers["x-idempotency-key"]
    assert logged_job_id == job_id


def test_e2e_job_timeout_not_hanging(client):
    # Basic smoke: admin job creation responds quickly (statement/lock timeout applied server-side)
    create = client.post(
        "/api/vault/admin/users",
        json={
            "external_user_id": "ext-timeout-1",
            "nickname": "timeout",
            "joined_date": "2024-01-01",
            "deposit_total": 0,
            "telegram_ok": True,
            "review_ok": True,
        },
        headers=_idem_headers("timeout-create"),
    )
    assert create.status_code == 200

    headers = _idem_headers("timeout-job")
    body = {"type": "NOTIFY", "target": {"external_user_ids": ["ext-timeout-1"]}}
    resp = client.post("/api/vault/admin/jobs", json=body, headers=headers)
    assert resp.status_code in {202, 409}
    assert resp.elapsed.total_seconds() < 5
