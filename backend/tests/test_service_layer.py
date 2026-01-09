"""
Test Phase 3: Service Layer

Tests for service layer functions:
- common.py: Idempotency, parsing, validation utilities
- vault_service.py: Status computation, validation, bulk updates
"""

import pytest
from datetime import datetime, timezone

# Common service imports
from app.services.common import (
    now_utc,
    generate_job_id,
    hash_request_body,
    validate_idempotency_key,
    validate_status,
    clamp_attendance_days,
)

# Vault service imports
from app.services.vault_service import (
    compute_gold_status,
    compute_platinum_status,
    compute_diamond_status,
    validate_claim_request,
    validate_status_modification,
)


class TestCommonServiceUtils:
    """Tests for common.py utilities."""
    
    def test_now_utc_returns_utc_datetime(self):
        result = now_utc()
        assert result.tzinfo == timezone.utc
    
    def test_generate_job_id_format(self):
        job_id = generate_job_id()
        assert job_id.startswith("job_")
        assert len(job_id) > 20  # job_YYYYMMDD_HHMMSS_8chars
    
    def test_generate_job_id_unique(self):
        job_ids = [generate_job_id() for _ in range(100)]
        assert len(set(job_ids)) == 100  # All unique
    
    def test_hash_request_body_consistent(self):
        body = {"key": "value", "number": 123}
        hash1 = hash_request_body(body)
        hash2 = hash_request_body(body)
        assert hash1 == hash2
    
    def test_hash_request_body_different_for_different_bodies(self):
        hash1 = hash_request_body({"key": "value1"})
        hash2 = hash_request_body({"key": "value2"})
        assert hash1 != hash2
    
    def test_hash_request_body_order_independent(self):
        hash1 = hash_request_body({"a": 1, "b": 2})
        hash2 = hash_request_body({"b": 2, "a": 1})
        assert hash1 == hash2
    
    def test_validate_idempotency_key_valid(self):
        result = validate_idempotency_key("my-key-123")
        assert result == "my-key-123"
    
    def test_validate_idempotency_key_generates_when_empty(self):
        result = validate_idempotency_key("")
        assert result.startswith("auto-")
    
    def test_validate_idempotency_key_generates_when_none(self):
        result = validate_idempotency_key(None)
        assert result.startswith("auto-")
    
    def test_validate_status_valid_values(self):
        for status in ["LOCKED", "UNLOCKED", "CLAIMED", "EXPIRED"]:
            assert validate_status(status, "gold_status") == status
    
    def test_clamp_attendance_days_within_bounds(self):
        result = clamp_attendance_days(2)
        assert result == 2
    
    def test_clamp_attendance_days_above_max(self):
        result = clamp_attendance_days(500)  # Max is 365
        assert result == 365
    
    def test_clamp_attendance_days_negative(self):
        result = clamp_attendance_days(-1)
        assert result == 0


class TestVaultServiceComputeStatus:
    """Tests for vault_service.py status computation."""
    
    # Gold status - compute_gold_status(m1, m2, m3, current_status)
    def test_gold_status_unlocked_when_all_missions_done(self):
        result = compute_gold_status(True, True, True, "LOCKED")
        assert result == "UNLOCKED"
    
    def test_gold_status_locked_when_not_all_missions_done(self):
        result = compute_gold_status(True, True, False, "LOCKED")
        assert result == "LOCKED"
    
    def test_gold_status_claimed_not_changed(self):
        result = compute_gold_status(True, True, True, "CLAIMED")
        assert result == "CLAIMED"
    
    def test_gold_status_expired_not_changed(self):
        result = compute_gold_status(True, True, True, "EXPIRED")
        assert result == "EXPIRED"
    
    # Platinum status - compute_platinum_status(deposit_total, deposit_count, attendance_days, review_ok, gold_status, current_status)
    def test_platinum_unlocked_when_conditions_met(self):
        result = compute_platinum_status(
            deposit_total=200_000,
            deposit_count=3,
            attendance_days=3,
            review_ok=True,
            gold_status="CLAIMED",
            current_status="LOCKED",
        )
        assert result == "UNLOCKED"
    
    def test_platinum_locked_when_deposit_insufficient(self):
        result = compute_platinum_status(
            deposit_total=100_000,
            deposit_count=3,
            attendance_days=3,
            review_ok=True,
            gold_status="CLAIMED",
            current_status="LOCKED",
        )
        assert result == "LOCKED"
    
    def test_platinum_claimed_not_changed(self):
        result = compute_platinum_status(
            deposit_total=200_000,
            deposit_count=3,
            attendance_days=3,
            review_ok=True,
            gold_status="CLAIMED",
            current_status="CLAIMED",
        )
        assert result == "CLAIMED"
    
    # Diamond status - compute_diamond_status(deposit_total, attendance_days, platinum_status, current_status)
    def test_diamond_unlocked_when_deposit_sufficient(self):
        result = compute_diamond_status(
            deposit_total=2_000_000,
            attendance_days=2,
            platinum_status="CLAIMED",
            current_status="LOCKED",
        )
        assert result == "UNLOCKED"
    
    def test_diamond_locked_when_deposit_insufficient(self):
        result = compute_diamond_status(
            deposit_total=1_000_000,
            attendance_days=2,
            platinum_status="CLAIMED",
            current_status="LOCKED",
        )
        assert result == "LOCKED"
    
    def test_diamond_claimed_not_changed(self):
        result = compute_diamond_status(
            deposit_total=2_000_000,
            attendance_days=2,
            platinum_status="CLAIMED",
            current_status="CLAIMED",
        )
        assert result == "CLAIMED"


class TestVaultServiceValidation:
    """Tests for vault_service.py validation functions."""
    
    def test_validate_claim_request_unlocked_allowed(self):
        # Should not raise
        validate_claim_request("GOLD", "UNLOCKED")
    
    def test_validate_claim_request_locked_raises(self):
        from fastapi import HTTPException
        with pytest.raises(HTTPException) as exc_info:
            validate_claim_request("GOLD", "LOCKED")
        assert exc_info.value.status_code == 403  # NOT_CLAIMABLE
    
    def test_validate_claim_request_already_claimed_raises(self):
        from fastapi import HTTPException
        with pytest.raises(HTTPException) as exc_info:
            validate_claim_request("GOLD", "CLAIMED")
        assert exc_info.value.status_code == 409  # ALREADY_CLAIMED
    
    def test_validate_status_modification_claimed_cannot_change(self):
        from fastapi import HTTPException
        with pytest.raises(HTTPException) as exc_info:
            validate_status_modification("CLAIMED", "UNLOCKED", "gold_status")
        assert exc_info.value.status_code == 409
        assert "CANNOT_MODIFY_CLAIMED" in str(exc_info.value.detail)
    
    def test_validate_status_modification_non_claimed_allowed(self):
        # Should not raise
        validate_status_modification("LOCKED", "UNLOCKED", "gold_status")
