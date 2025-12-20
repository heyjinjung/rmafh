def test_compensation_enqueue(client, db_conn):
    cur = db_conn.cursor()
    cur.execute("DELETE FROM compensation_queue")
    cur.execute(
        """
        INSERT INTO user_identity (user_id, external_user_id)
        VALUES (%s, %s)
        ON CONFLICT (external_user_id) DO UPDATE SET user_id = EXCLUDED.user_id
        """,
        (1301, "ext-1301"),
    )
    db_conn.commit()

    payload = {
        "external_user_id": "ext-1301",
        "vault_type": "GOLD",
        "request_id": "test-comp-001",
        "external_service": "reward-system",
        "payload": {"amount": 100}
    }
    resp = client.post("/api/vault/compensation-enqueue", json=payload)
    assert resp.status_code == 202

    cur.execute("SELECT status FROM compensation_queue WHERE request_id='test-comp-001' AND external_service='reward-system'")
    row = cur.fetchone()
    assert row is not None
    assert row[0] in {"PENDING", "RETRYING", "DONE"}
