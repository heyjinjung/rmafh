from datetime import datetime, timedelta, timezone
from typing import List

from fastapi import FastAPI, HTTPException
from fastapi.responses import JSONResponse

from app import config, db
from app.schemas import (
    CompensationEnqueueRequest,
    ExtendExpiryRequest,
    ExtendExpiryResponse,
    HealthResponse,
    NotifyRequest,
    NotifyResponse,
    ReferralReviveRequest,
    ReferralReviveResponse,
)

app = FastAPI(title="Vault v2.0 API", version="0.2.0")


@app.on_event("startup")
def _startup():
    db.init_pool()


@app.on_event("shutdown")
def _shutdown():
    db.close_pool()


@app.get("/health", response_model=HealthResponse)
async def health():
    return HealthResponse(status="ok")


def _now():
    return datetime.now(timezone.utc)


@app.post("/api/vault/referral-revive", response_model=ReferralReviveResponse)
async def referral_revive(body: ReferralReviveRequest, user_id: int):
    """만료 D-1 구간에서 24h 연장 (1회 제한)."""
    with db.get_conn() as conn:
        cur = conn.cursor()
        cur.execute(
            """
            SELECT expires_at, expiry_extend_count
            FROM vault_status
            WHERE user_id=%s
            FOR UPDATE
            """,
            (user_id,),
        )
        row = cur.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="NOT_FOUND")
        expires_at, extend_count = row
        now = _now()
        if not (now + timedelta(hours=24) <= expires_at <= now + timedelta(hours=48)):
            raise HTTPException(status_code=403, detail="EXTENSION_FORBIDDEN")
        if extend_count > 0:
            raise HTTPException(status_code=409, detail="EXTENSION_LIMIT")

        new_expires = expires_at + timedelta(hours=24)
        cur.execute(
            """
            UPDATE vault_status
               SET expires_at=%s,
                   expiry_extend_count=expiry_extend_count+1,
                   last_extension_reason='REFERRAL',
                   last_extension_at=%s
             WHERE user_id=%s
            """,
            (new_expires, now, user_id),
        )
        cur.execute(
            """
            INSERT INTO vault_expiry_extension_log
                (user_id, prev_expires_at, new_expires_at, reason, request_id, shadow, metadata)
            VALUES (%s, %s, %s, %s, %s, false, jsonb_build_object('channel', %s, 'invite_code', %s))
            ON CONFLICT (request_id) DO NOTHING
            """,
            (user_id, expires_at, new_expires, "REFERRAL", body.request_id, body.channel, body.invite_code),
        )
        conn.commit()
        return ReferralReviveResponse(revived=True, expires_at=new_expires.isoformat())


@app.post("/api/vault/extend-expiry", response_model=ExtendExpiryResponse)
async def extend_expiry(body: ExtendExpiryRequest):
    """운영/프로모션 만료 연장. shadow=true면 미적용 프리뷰."""
    if body.scope not in {"ALL_ACTIVE", "USER_IDS"}:
        raise HTTPException(status_code=400, detail="INVALID_SCOPE")
    if body.scope == "USER_IDS" and not body.user_ids:
        raise HTTPException(status_code=400, detail="USER_IDS_REQUIRED")
    if not (1 <= body.extend_hours <= 72):
        raise HTTPException(status_code=400, detail="INVALID_EXTEND_HOURS")

    with db.get_conn() as conn:
        cur = conn.cursor()
        now = _now()
        if body.scope == "USER_IDS":
            cur.execute(
                """
                SELECT user_id, expires_at
                  FROM vault_status
                 WHERE user_id = ANY(%s)
                   AND (gold_status!='CLAIMED' OR platinum_status!='CLAIMED' OR diamond_status!='CLAIMED')
                """,
                (body.user_ids,),
            )
            rows = cur.fetchall()
        else:
            cur.execute(
                """
                SELECT user_id, expires_at
                  FROM vault_status
                 WHERE (gold_status!='CLAIMED' OR platinum_status!='CLAIMED' OR diamond_status!='CLAIMED')
                """,
            )
            rows = cur.fetchall()

        if body.shadow:
            sample_ids = [r[0] for r in rows[:10]]
            return ExtendExpiryResponse(shadow=True, candidates=len(rows), sample_user_ids=sample_ids)

        new_expires_at = None
        updated = 0
        for user_id, expires_at in rows:
            new_expires = expires_at + timedelta(hours=body.extend_hours)
            new_expires_at = new_expires
            cur.execute(
                """
                UPDATE vault_status
                   SET expires_at=%s,
                       expiry_extend_count=expiry_extend_count+1,
                       last_extension_reason=%s,
                       last_extension_at=%s
                 WHERE user_id=%s
                """,
                (new_expires, body.reason, now, user_id),
            )
            cur.execute(
                """
                INSERT INTO vault_expiry_extension_log
                    (user_id, prev_expires_at, new_expires_at, reason, request_id, shadow, metadata)
                VALUES (%s, %s, %s, %s, %s, false, NULL)
                ON CONFLICT (request_id) DO NOTHING
                """,
                (user_id, expires_at, new_expires, body.reason, body.request_id),
            )
            updated += 1
        conn.commit()
        return ExtendExpiryResponse(shadow=False, updated=updated, new_expires_at=new_expires_at.isoformat() if new_expires_at else None)


@app.post("/api/vault/notify", response_model=NotifyResponse)
async def notify(body: NotifyRequest):
    if body.type not in config.ALLOWED_NOTIFY_TYPES:
        raise HTTPException(status_code=400, detail="INVALID_NOTIFY_TYPE")
    if not body.user_ids:
        raise HTTPException(status_code=400, detail="EMPTY_USER_IDS")
    if body.variant_id and body.variant_id not in config.ALLOWED_VARIANT_IDS:
        raise HTTPException(status_code=400, detail="VARIANT_NOT_FOUND")

    now = _now()
    dedup_suffix = body.variant_id or "base"
    inserted = 0
    with db.get_conn() as conn:
        cur = conn.cursor()
        for uid in body.user_ids:
            dedup_key = f"{body.type}:{uid}:{dedup_suffix}:{now.date()}"
            cur.execute(
                """
                INSERT INTO notifications_queue
                    (user_id, type, vault_type, variant_id, dedup_key, payload, scheduled_at, status)
                VALUES (%s, %s, NULL, %s, %s, %s, %s, 'PENDING')
                ON CONFLICT (dedup_key) DO NOTHING
                """,
                (uid, body.type, body.variant_id, dedup_key, {"type": body.type, "variant_id": body.variant_id}, now),
            )
            if cur.rowcount > 0:
                inserted += 1
        conn.commit()
    return NotifyResponse(enqueued=inserted)


@app.post("/api/vault/compensation-enqueue")
async def compensation_enqueue(body: CompensationEnqueueRequest):
    with db.get_conn() as conn:
        cur = conn.cursor()
        cur.execute(
            """
            INSERT INTO compensation_queue
                (user_id, vault_type, request_id, external_service, payload, status, retry_count, next_retry_at)
            VALUES (%s, %s, %s, %s, %s, 'PENDING', 0, NOW())
            ON CONFLICT (request_id, external_service) DO NOTHING
            """,
            (body.user_id, body.vault_type, body.request_id, body.external_service, body.payload),
        )
        conn.commit()
    return JSONResponse(status_code=202, content={"enqueued": True})
