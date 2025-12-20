from datetime import timedelta


def test_referral_revive_allows_once(client, db_conn):
    cur = db_conn.cursor()
    # reset test user window in D-1 to D-2 range
    cur.execute(
        """
        INSERT INTO vault_status (user_id, expires_at, expiry_extend_count, last_extension_reason, last_extension_at)
        VALUES (%s, NOW() + INTERVAL '36 hours', 0, NULL, NULL)
        ON CONFLICT (user_id) DO UPDATE
          SET expires_at = EXCLUDED.expires_at,
              expiry_extend_count = 0,
              last_extension_reason = NULL,
              last_extension_at = NULL
        """,
        (1401,),
    )
    db_conn.commit()

    payload = {"request_id": "test-ref-001", "channel": "kakao", "invite_code": "TESTCODE"}
    resp = client.post("/api/vault/referral-revive", params={"user_id": 1401}, json=payload)
    assert resp.status_code == 200
    body = resp.json()
    assert body.get("revived") is True

    cur.execute("SELECT expiry_extend_count FROM vault_status WHERE user_id=%s", (1401,))
    extend_count = cur.fetchone()[0]
    assert extend_count == 1

    # second attempt should hit EXTENSION_LIMIT
    resp_limit = client.post("/api/vault/referral-revive", params={"user_id": 1401}, json=payload)
    assert resp_limit.status_code == 409
    assert resp_limit.json().get("detail") == "EXTENSION_LIMIT"
