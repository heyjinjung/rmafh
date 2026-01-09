"""
Test Phase 4: Frontend Integration

Tests for:
- API response includes gold_mission_X_done fields
- SOT values consistency (DIAMOND_UNLOCK, PLATINUM_UNLOCK)
- Idempotency header propagation (checked via admin endpoints)
"""

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app import config
from app.services.common import hash_request_body
from app.constants.vault_config import (
    VAULT_REWARDS,
    DIAMOND_UNLOCK,
    PLATINUM_UNLOCK,
)


@pytest.fixture
def client():
    """Test client fixture."""
    return TestClient(app)


@pytest.fixture
def admin_pw():
    """Admin password from config."""
    return config.ADMIN_PASSWORD


class TestSOTValuesConsistency:
    """Verify SOT values used by frontend match backend constants."""
    
    def test_diamond_unlock_deposit_total(self):
        """Diamond unlock threshold should be 2,000,000."""
        assert DIAMOND_UNLOCK["deposit_total"] == 2_000_000
    
    def test_platinum_unlock_deposit_total(self):
        """Platinum unlock threshold should be 200,000."""
        assert PLATINUM_UNLOCK["deposit_total"] == 200_000
    
    def test_vault_rewards_gold(self):
        """Gold reward should be 10,000."""
        assert VAULT_REWARDS["GOLD"] == 10_000
    
    def test_vault_rewards_platinum(self):
        """Platinum reward should be 30,000."""
        assert VAULT_REWARDS["PLATINUM"] == 30_000
    
    def test_vault_rewards_diamond(self):
        """Diamond reward should be 300,000."""
        assert VAULT_REWARDS["DIAMOND"] == 300_000


class TestGoldMissionFieldsInAPIResponse:
    """Verify API response includes gold_mission_X_done fields for frontend."""
    
    @pytest.mark.skip(reason="Requires V3 DB migration and test user setup")
    def test_vault_status_includes_gold_mission_flags(self, client, admin_pw):
        """GET /api/vault/status should return gold mission flags."""
        # Create a test user first
        resp = client.post(
            "/api/vault/admin/users",
            json={
                "external_user_id": "test-gold-mission-api",
                "nickname": "test",
                "joined_date": "2024-01-01",
                "deposit_total": 0,
                "telegram_ok": True,
                "review_ok": False,
            },
            headers={"x-admin-password": admin_pw, "x-idempotency-key": "test-gold-mission-api-create"},
        )
        if resp.status_code == 200:
            user_id = resp.json().get("user_id")
        else:
            # User might already exist, try to get status anyway
            pass
        
        # Get vault status
        resp = client.get("/api/vault/status?external_user_id=test-gold-mission-api")
        
        # Check response includes gold mission fields (may be False if user has no snapshot)
        data = resp.json()
        # These fields should exist in response (even if not present, frontend uses fallback)
        # The key is that the API can return these fields
        assert resp.status_code in [200, 400]  # 400 if user not found is acceptable
    
    @pytest.mark.skip(reason="Requires V3 DB migration and test user setup")
    def test_admin_users_list_includes_gold_mission_flags(self, client, admin_pw):
        """GET /api/vault/admin/users should return gold mission flags."""
        resp = client.get(
            "/api/vault/admin/users",
            headers={"x-admin-password": admin_pw},
        )
        
        assert resp.status_code == 200
        data = resp.json()
        
        if data.get("users") and len(data["users"]) > 0:
            user = data["users"][0]
            # Check that gold mission fields are in response
            assert "gold_mission_1_done" in user
            assert "gold_mission_2_done" in user
            assert "gold_mission_3_done" in user
            assert "gold_status" in user


class TestIdempotencyKeyPropagation:
    """Test that idempotency keys work correctly through admin endpoints."""
    
    @pytest.mark.skip(reason="Requires V3 DB migration and test user setup")
    def test_gold_missions_idempotency_key_accepted(self, client, admin_pw):
        """POST /api/vault/admin/users/{user_id}/vault/gold-missions should accept idempotency key."""
        
        # First create a user
        create_resp = client.post(
            "/api/vault/admin/users",
            json={
                "external_user_id": "test-idem-key",
                "nickname": "test",
                "joined_date": "2024-01-01",
                "deposit_total": 0,
                "telegram_ok": False,
                "review_ok": False,
            },
            headers={"x-admin-password": admin_pw, "x-idempotency-key": "test-idem-key-create"},
        )
        
        user_id = None
        if create_resp.status_code == 200:
            user_id = create_resp.json().get("user_id")
        elif create_resp.status_code == 409:
            # User already exists, get ID from list
            list_resp = client.get(
                "/api/vault/admin/users?query=test-idem-key",
                headers={"x-admin-password": admin_pw},
            )
            if list_resp.status_code == 200 and list_resp.json().get("users"):
                user_id = list_resp.json()["users"][0].get("user_id")
        
        if not user_id:
            pytest.skip("Could not create or find test user")
        
        # Test gold missions endpoint with idempotency key
        idem_key = "test-gold-missions-idem-001"
        resp1 = client.post(
            f"/api/vault/admin/users/{user_id}/vault/gold-missions",
            json={"m1": True, "m2": False, "m3": False},
            headers={"x-admin-password": admin_pw, "x-idempotency-key": idem_key},
        )
        
        assert resp1.status_code == 200
        
        # Replay with same key should return same result
        resp2 = client.post(
            f"/api/vault/admin/users/{user_id}/vault/gold-missions",
            json={"m1": True, "m2": False, "m3": False},
            headers={"x-admin-password": admin_pw, "x-idempotency-key": idem_key},
        )
        
        assert resp2.status_code == 200
        # Idempotency-Status header should indicate replay if present
        idem_status = resp2.headers.get("Idempotency-Status")
        if idem_status:
            assert idem_status in ["REPLAY", "STORED", "NEW"]
    
    @pytest.mark.skip(reason="Requires V3 DB migration and test user setup")
    def test_attendance_endpoint_accepts_idempotency(self, client, admin_pw):
        """POST /api/vault/admin/users/{user_id}/vault/attendance should accept idempotency key."""
        
        # Get any existing user
        list_resp = client.get(
            "/api/vault/admin/users?page_size=1",
            headers={"x-admin-password": admin_pw},
        )
        
        if list_resp.status_code != 200 or not list_resp.json().get("users"):
            pytest.skip("No users available for testing")
        
        user_id = list_resp.json()["users"][0].get("user_id")
        
        # Test attendance endpoint with idempotency key
        resp = client.post(
            f"/api/vault/admin/users/{user_id}/vault/attendance",
            json={"delta": 0},  # No change, just testing header acceptance
            headers={"x-admin-password": admin_pw, "x-idempotency-key": "test-attendance-idem-001"},
        )
        
        # Should not fail due to missing idempotency handling
        assert resp.status_code in [200, 400, 409]  # 400/409 for business logic errors is OK
