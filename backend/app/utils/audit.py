from psycopg2.extras import Json


def _log_admin_action(
    conn,
    admin_user: str,
    action: str,
    endpoint: str,
    target_user_ids: list[int] | None,
    request_id: str | None,
    request_body: dict | None,
    response_status: str,
    response_summary: dict | None,
    error_message: str | None = None,
    metadata: dict | None = None,
    *,
    job_id: str | None = None,
    idempotency_key: str | None = None,
):
    """Admin audit log record."""
    cur = conn.cursor()
    target_user_ids_array = target_user_ids if target_user_ids else []
    target_count = len(target_user_ids_array) if target_user_ids_array else 0

    cur.execute(
        """
        INSERT INTO admin_audit_log
            (admin_user, action, endpoint, target_user_ids, target_count,
             request_id, request_body, response_status, response_summary, error_message, metadata,
             job_id, idempotency_key)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """,
        (
            admin_user,
            action,
            endpoint,
            Json(target_user_ids_array),
            target_count,
            request_id,
            Json(request_body) if request_body else None,
            response_status,
            Json(response_summary) if response_summary else None,
            error_message,
            Json(metadata) if metadata else None,
            job_id,
            idempotency_key,
        ),
    )
