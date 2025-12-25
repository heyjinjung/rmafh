from uuid import uuid4


def _idem_headers(prefix: str = "test-job"):
    return {"x-idempotency-key": f"{prefix}-{uuid4()}"}


def test_admin_job_state_transitions(client, db_conn):
    # Seed users so job target resolution works
    cur = db_conn.cursor()
    cur.execute(
        """
        INSERT INTO user_identity (user_id, external_user_id)
        VALUES (%s, %s), (%s, %s)
        ON CONFLICT (external_user_id) DO UPDATE SET user_id = EXCLUDED.user_id
        """,
        (5001, "ext-job-1", 5002, "ext-job-2"),
    )
    db_conn.commit()

    headers = _idem_headers("job-state")
    body = {
        "type": "NOTIFY",
        "target": {"external_user_ids": ["ext-job-1", "ext-job-2"]},
        "payload": {"foo": "bar"},
    }

    created = client.post("/api/vault/admin/jobs", json=body, headers=headers)
    assert created.status_code == 202
    job_id = created.json()["job_id"]
    assert created.json()["status"] == "PENDING"

    items = client.get(f"/api/vault/admin/jobs/{job_id}/items").json()["items"]
    assert len(items) == 2
    assert all(i["status"] == "PENDING" for i in items)

    # Simulate worker progression: RUNNING -> DONE with mixed item outcomes
    cur.execute(
        "UPDATE admin_jobs SET status='RUNNING', processed=0, failed=0, updated_at=NOW() WHERE job_id=%s",
        (job_id,),
    )
    cur.execute("UPDATE admin_job_items SET status='RUNNING' WHERE job_id=%s", (job_id,))
    cur.execute(
        "UPDATE admin_jobs SET status='DONE', processed=2, failed=1, updated_at=NOW() WHERE job_id=%s",
        (job_id,),
    )
    cur.execute(
        "UPDATE admin_job_items SET status='DONE' WHERE job_id=%s AND user_id=%s",
        (job_id, 5001),
    )
    cur.execute(
        "UPDATE admin_job_items SET status='FAILED', error_message='boom' WHERE job_id=%s AND user_id=%s",
        (job_id, 5002),
    )
    db_conn.commit()

    detail = client.get(f"/api/vault/admin/jobs/{job_id}")
    assert detail.status_code == 200
    detail_body = detail.json()
    assert detail_body["status"] == "DONE"
    assert detail_body["processed"] == 2
    assert detail_body["failed"] == 1

    items_after = client.get(f"/api/vault/admin/jobs/{job_id}/items").json()["items"]
    statuses = {item["user_id"]: item["status"] for item in items_after}
    assert statuses[5001] == "DONE"
    assert statuses[5002] == "FAILED"
    assert any(item.get("error_message") == "boom" for item in items_after)

    retry = client.post(f"/api/vault/admin/jobs/{job_id}/retry")
    assert retry.status_code == 409
    assert retry.json().get("detail") == "JOB_INVALID_STATE"