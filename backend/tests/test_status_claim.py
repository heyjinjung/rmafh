from datetime import datetime
from uuid import uuid4


def _idem_headers():
    return {"x-idempotency-key": f"test-claim-import-{uuid4()}"}


def test_status_returns_contract_fields(client):
    resp = client.get("/api/vault/status")
    assert resp.status_code == 200
    data = resp.json()

    # Basic contract keys
    for key in (
        "gold_status",
        "platinum_status",
        "diamond_status",
        "platinum_attendance_days",
        "platinum_deposit_done",
        "platinum_review_done",
        "telegram_ok",
        "diamond_deposit_current",
        "expires_at",
        "now",
        "loss_total",
        "loss_breakdown",
        "ms_countdown",
        "social_proof",
        "curation_tier",
    ):
        assert key in data

    # Type/shape checks for frequently used fields
    assert isinstance(data["ms_countdown"].get("enabled"), bool)
    assert isinstance(data["ms_countdown"].get("remaining_ms"), int)
    assert isinstance(data["loss_breakdown"], dict)
    assert set(["GOLD", "PLATINUM", "DIAMOND", "BONUS"]).issubset(set(data["loss_breakdown"].keys()))

    # ISO timestamps should parse
    datetime.fromisoformat(data["now"])  # noqa: B018
    datetime.fromisoformat(data["expires_at"])  # noqa: B018


def test_claim_flow_after_daily_import_unlocks_and_updates_status(client):
    external_user_id = "ext-claim-flow-1"

    # Import snapshot to unlock GOLD/DIAMOND
    body = {
        "rows": [
            {
                "external_user_id": external_user_id,
                "deposit_total": 2500000,  # 250만원 - 다이아몬드 해금 조건 충족
                "telegram_ok": True,
                "review_ok": True,
                "last_deposit_at": "2025-12-21",
            }
        ]
    }
    import_resp = client.post("/api/vault/user-daily-import", json=body, headers=_idem_headers())
    assert import_resp.status_code == 200

    status_before = client.get("/api/vault/status", params={"external_user_id": external_user_id})
    assert status_before.status_code == 200
    data_before = status_before.json()
    assert data_before["gold_status"] == "UNLOCKED"
    assert data_before["diamond_status"] == "UNLOCKED"

    claim_resp = client.post(
        "/api/vault/claim",
        params={"external_user_id": external_user_id},
        json={"vault_type": "DIAMOND"},
    )
    assert claim_resp.status_code == 200
    claim_body = claim_resp.json()
    assert claim_body.get("claimed") is True
    assert claim_body.get("vault_type") == "DIAMOND"

    status_after = client.get("/api/vault/status", params={"external_user_id": external_user_id})
    assert status_after.status_code == 200
    data_after = status_after.json()
    assert data_after["diamond_status"] == "CLAIMED"
    assert data_after["loss_breakdown"].get("DIAMOND") == 0


def test_claim_enforces_state_and_idempotency(client):
    external_user_id = "ext-claim-guard-1"

    # First create user via import with telegram_ok=False, platinum conditions not met
    setup_resp = client.post(
        "/api/vault/user-daily-import",
        json={
            "rows": [
                {
                    "external_user_id": external_user_id,
                    "deposit_total": 0,
                    "telegram_ok": False,
                    "review_ok": False,
                    "last_deposit_at": "2025-12-20",
                }
            ]
        },
        headers=_idem_headers(),
    )
    assert setup_resp.status_code == 200

    # Platinum is locked by default, so claim should be forbidden.
    locked_resp = client.post(
        "/api/vault/claim",
        params={"external_user_id": external_user_id},
        json={"vault_type": "PLATINUM"},
    )
    assert locked_resp.status_code == 403
    assert locked_resp.json().get("detail") == "NOT_CLAIMABLE"

    # GOLD is unlocked only after daily import marks telegram_ok=true.
    import_resp = client.post(
        "/api/vault/user-daily-import",
        json={
            "rows": [
                {
                    "external_user_id": external_user_id,
                    "deposit_total": 0,
                    "telegram_ok": True,
                    "review_ok": False,
                    "last_deposit_at": "2025-12-20",
                }
            ]
        },
        headers=_idem_headers(),
    )
    assert import_resp.status_code == 200

    # First claim succeeds, second claim conflicts.
    first_claim = client.post(
        "/api/vault/claim",
        params={"external_user_id": external_user_id},
        json={"vault_type": "GOLD"},
    )
    assert first_claim.status_code == 200

    duplicate_claim = client.post(
        "/api/vault/claim",
        params={"external_user_id": external_user_id},
        json={"vault_type": "GOLD"},
    )
    assert duplicate_claim.status_code == 409
    assert duplicate_claim.json().get("detail") == "ALREADY_CLAIMED"
