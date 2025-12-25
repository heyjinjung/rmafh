import asyncio
from datetime import datetime, timezone, timedelta

from app import config, db


async def process_once(conn):
    cur = conn.cursor()
    cur.execute("SET LOCAL lock_timeout = %s", (f"{config.JOB_LOCK_TIMEOUT_MS}ms",))
    cur.execute("SET LOCAL statement_timeout = %s", (f"{config.JOB_STATEMENT_TIMEOUT_MS}ms",))
    now = datetime.now(timezone.utc)
    cur.execute(
        """
        SELECT id, user_id, vault_type, request_id, external_service, payload, retry_count
          FROM compensation_queue
         WHERE status IN ('PENDING','RETRYING')
           AND next_retry_at <= %s
         ORDER BY next_retry_at ASC
         LIMIT 20
        """,
        (now,),
    )
    rows = cur.fetchall()
    if not rows:
        return 0

    processed = 0
    for row in rows:
        cid, user_id, vault_type, request_id, external_service, payload, retry_count = row
        # Simulate external call success
        success = True
        if success:
            cur.execute(
                "UPDATE compensation_queue SET status='DONE', last_error=NULL WHERE id=%s",
                (cid,),
            )
        else:
            retry = retry_count + 1
            if retry >= config.COMPENSATION_MAX_RETRIES:
                cur.execute(
                    "UPDATE compensation_queue SET status='FAILED', last_error=%s WHERE id=%s",
                    ("max retries reached", cid),
                )
            else:
                backoff = config.COMPENSATION_BACKOFF_SECONDS[min(retry - 1, len(config.COMPENSATION_BACKOFF_SECONDS) - 1)]
                cur.execute(
                    """
                    UPDATE compensation_queue
                       SET status='RETRYING',
                           retry_count=%s,
                           next_retry_at=%s,
                           last_error=%s
                     WHERE id=%s
                    """,
                    (retry, now + timedelta(seconds=backoff), "retrying", cid),
                )
        processed += 1
    conn.commit()
    return processed


async def main():
    db.init_pool()
    try:
        while True:
            with db.get_conn() as conn:
                await asyncio.to_thread(process_once, conn)
            await asyncio.sleep(5)
    finally:
        db.close_pool()


if __name__ == "__main__":
    asyncio.run(main())
