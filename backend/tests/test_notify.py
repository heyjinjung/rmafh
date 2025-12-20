from datetime import datetime, timezone


def test_notify_enqueues(client, db_conn):
    cur = db_conn.cursor()
    cur.execute("DELETE FROM notifications_queue")
    cur.execute(
        """
        INSERT INTO user_identity (user_id, external_user_id)
        VALUES
          (%s, %s),
          (%s, %s)
        ON CONFLICT (external_user_id) DO UPDATE SET user_id = EXCLUDED.user_id
        """,
        (1101, "ext-1101", 1102, "ext-1102"),
    )
    db_conn.commit()

    body = {"type": "EXPIRY_D2", "external_user_ids": ["ext-1101", "ext-1102"], "variant_id": "A"}
    resp = client.post("/api/vault/notify", json=body)
    assert resp.status_code == 200
    data = resp.json()
    assert data.get("enqueued", 0) >= 1

    cur.execute("SELECT COUNT(*) FROM notifications_queue WHERE type='EXPIRY_D2'")
    count = cur.fetchone()[0]
    assert count == data.get("enqueued")

    # dedup same day should not double insert
    resp_dup = client.post("/api/vault/notify", json=body)
    assert resp_dup.status_code == 200
    cur.execute("SELECT COUNT(*) FROM notifications_queue WHERE type='EXPIRY_D2'")
    count_after_dup = cur.fetchone()[0]
    assert count_after_dup == count


def test_notify_variant_validation(client):
    bad_body = {"type": "EXPIRY_D2", "user_ids": [1201], "variant_id": "NOT_ALLOWED"}
    resp = client.post("/api/vault/notify", json=bad_body)
    assert resp.status_code == 400
    assert resp.json().get("detail") == "VARIANT_NOT_FOUND"


def test_notify_requires_users(client):
    resp = client.post("/api/vault/notify", json={"type": "EXPIRY_D2", "external_user_ids": []})
    assert resp.status_code == 400
    assert resp.json().get("detail") == "EMPTY_USER_IDS"
