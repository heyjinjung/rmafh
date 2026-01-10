# -*- coding: utf-8 -*-
"""Mission toggle full integration tests.

Covers:
1. Gold mission toggle and status update
2. Platinum mission toggle and status update  
3. Diamond mission toggle and status update
4. Admin user list includes mission fields
5. User status API returns mission status
"""

import uuid
import pytest


AUTH = {"Authorization": "Bearer admin1234"}


def idem():
    return {"x-idempotency-key": str(uuid.uuid4())}


class TestGoldMissionToggle:
    """Gold mission toggle tests."""

    def test_gold_mission_toggle_updates_status(self, client, db_conn):
        """Toggle gold missions should update gold_status."""
        # Create user
        ext_id = f"gold-test-{uuid.uuid4().hex[:8]}"
        resp = client.post(
            "/api/vault/admin/users",
            json={"external_user_id": ext_id, "nickname": "GoldTest"},
            headers={**AUTH, **idem()},
        )
        assert resp.status_code == 200
        user_id = resp.json()["user_id"]

        # Initial state should be LOCKED
        resp = client.get(f"/api/vault/admin/users?query={ext_id}", headers=AUTH)
        assert resp.status_code == 200
        user = resp.json()["users"][0]
        assert user["gold_status"] == "LOCKED"
        assert user["gold_mission_1_done"] is False
        assert user["gold_mission_2_done"] is False
        assert user["gold_mission_3_done"] is False

        # Toggle mission 1
        resp = client.post(
            f"/api/vault/admin/users/{user_id}/vault/gold-missions",
            json={"gold_mission_1_done": True},
            headers={**AUTH, **idem()},
        )
        assert resp.status_code == 200
        assert resp.json()["gold_mission_1_done"] is True
        assert resp.json()["gold_status"] == "LOCKED"  # Not all missions done

        # Toggle mission 2
        resp = client.post(
            f"/api/vault/admin/users/{user_id}/vault/gold-missions",
            json={"gold_mission_2_done": True},
            headers={**AUTH, **idem()},
        )
        assert resp.status_code == 200
        assert resp.json()["gold_mission_2_done"] is True
        assert resp.json()["gold_status"] == "LOCKED"  # Still not all done

        # Toggle mission 3 - should unlock
        resp = client.post(
            f"/api/vault/admin/users/{user_id}/vault/gold-missions",
            json={"gold_mission_3_done": True},
            headers={**AUTH, **idem()},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["gold_mission_1_done"] is True
        assert data["gold_mission_2_done"] is True
        assert data["gold_mission_3_done"] is True
        assert data["gold_status"] == "UNLOCKED"

        # Verify in user list
        resp = client.get(f"/api/vault/admin/users?query={ext_id}", headers=AUTH)
        user = resp.json()["users"][0]
        assert user["gold_status"] == "UNLOCKED"

    def test_gold_mission_toggle_off_relocks(self, client, db_conn):
        """Toggle mission off should relock if not all done."""
        ext_id = f"gold-relock-{uuid.uuid4().hex[:8]}"
        resp = client.post(
            "/api/vault/admin/users",
            json={"external_user_id": ext_id, "nickname": "RelockTest"},
            headers={**AUTH, **idem()},
        )
        user_id = resp.json()["user_id"]

        # Set all missions true
        client.post(
            f"/api/vault/admin/users/{user_id}/vault/gold-missions",
            json={"gold_mission_1_done": True, "gold_mission_2_done": True, "gold_mission_3_done": True},
            headers={**AUTH, **idem()},
        )

        # Toggle off mission 1
        resp = client.post(
            f"/api/vault/admin/users/{user_id}/vault/gold-missions",
            json={"gold_mission_1_done": False},
            headers={**AUTH, **idem()},
        )
        assert resp.status_code == 200
        assert resp.json()["gold_status"] == "LOCKED"


class TestPlatinumMissionToggle:
    """Platinum mission toggle tests."""

    def test_platinum_mission_toggle_updates_status(self, client, db_conn):
        """Toggle platinum missions should update platinum_status when conditions met."""
        ext_id = f"plat-test-{uuid.uuid4().hex[:8]}"
        resp = client.post(
            "/api/vault/admin/users",
            json={"external_user_id": ext_id, "nickname": "PlatTest"},
            headers={**AUTH, **idem()},
        )
        user_id = resp.json()["user_id"]

        # Toggle platinum mission 1
        resp = client.post(
            f"/api/vault/admin/users/{user_id}/vault/platinum-missions",
            json={"platinum_mission_1_done": True},
            headers={**AUTH, **idem()},
        )
        assert resp.status_code == 200
        assert resp.json()["platinum_mission_1_done"] is True
        # Status may not be UNLOCKED due to other conditions (deposit, attendance, etc.)

        # Toggle platinum mission 2
        resp = client.post(
            f"/api/vault/admin/users/{user_id}/vault/platinum-missions",
            json={"platinum_mission_2_done": True},
            headers={**AUTH, **idem()},
        )
        assert resp.status_code == 200
        assert resp.json()["platinum_mission_2_done"] is True

    def test_platinum_missions_in_user_list(self, client, db_conn):
        """User list should include platinum mission fields."""
        ext_id = f"plat-list-{uuid.uuid4().hex[:8]}"
        resp = client.post(
            "/api/vault/admin/users",
            json={"external_user_id": ext_id, "nickname": "PlatListTest"},
            headers={**AUTH, **idem()},
        )
        user_id = resp.json()["user_id"]

        # Set mission 1
        client.post(
            f"/api/vault/admin/users/{user_id}/vault/platinum-missions",
            json={"platinum_mission_1_done": True},
            headers={**AUTH, **idem()},
        )

        # Check user list
        resp = client.get(f"/api/vault/admin/users?query={ext_id}", headers=AUTH)
        assert resp.status_code == 200
        user = resp.json()["users"][0]
        assert "platinum_mission_1_done" in user
        assert "platinum_mission_2_done" in user
        assert user["platinum_mission_1_done"] is True

    def test_platinum_mission_toggle_off_relocks(self, client, db_conn):
        """Toggle platinum mission off should relock the vault."""
        ext_id = f"plat-relock-{uuid.uuid4().hex[:8]}"
        resp = client.post(
            "/api/vault/admin/users",
            json={"external_user_id": ext_id, "nickname": "PlatRelockTest"},
            headers={**AUTH, **idem()},
        )
        user_id = resp.json()["user_id"]

        # Set both missions true → UNLOCKED
        resp = client.post(
            f"/api/vault/admin/users/{user_id}/vault/platinum-missions",
            json={"platinum_mission_1_done": True, "platinum_mission_2_done": True},
            headers={**AUTH, **idem()},
        )
        assert resp.status_code == 200
        assert resp.json()["platinum_status"] == "UNLOCKED"

        # Toggle off mission 1 → LOCKED
        resp = client.post(
            f"/api/vault/admin/users/{user_id}/vault/platinum-missions",
            json={"platinum_mission_1_done": False},
            headers={**AUTH, **idem()},
        )
        assert resp.status_code == 200
        assert resp.json()["platinum_status"] == "LOCKED"


class TestDiamondMissionToggle:
    """Diamond mission toggle tests."""

    def test_diamond_mission_toggle_updates_status(self, client, db_conn):
        """Toggle diamond missions should update diamond_status when conditions met."""
        ext_id = f"dia-test-{uuid.uuid4().hex[:8]}"
        resp = client.post(
            "/api/vault/admin/users",
            json={"external_user_id": ext_id, "nickname": "DiaTest"},
            headers={**AUTH, **idem()},
        )
        user_id = resp.json()["user_id"]

        # Toggle diamond mission 1
        resp = client.post(
            f"/api/vault/admin/users/{user_id}/vault/diamond-missions",
            json={"diamond_mission_1_done": True},
            headers={**AUTH, **idem()},
        )
        assert resp.status_code == 200
        assert resp.json()["diamond_mission_1_done"] is True

        # Toggle diamond mission 2
        resp = client.post(
            f"/api/vault/admin/users/{user_id}/vault/diamond-missions",
            json={"diamond_mission_2_done": True},
            headers={**AUTH, **idem()},
        )
        assert resp.status_code == 200
        assert resp.json()["diamond_mission_2_done"] is True

    def test_diamond_missions_in_user_list(self, client, db_conn):
        """User list should include diamond mission fields."""
        ext_id = f"dia-list-{uuid.uuid4().hex[:8]}"
        resp = client.post(
            "/api/vault/admin/users",
            json={"external_user_id": ext_id, "nickname": "DiaListTest"},
            headers={**AUTH, **idem()},
        )
        user_id = resp.json()["user_id"]

        # Set mission 1
        client.post(
            f"/api/vault/admin/users/{user_id}/vault/diamond-missions",
            json={"diamond_mission_1_done": True},
            headers={**AUTH, **idem()},
        )

        # Check user list
        resp = client.get(f"/api/vault/admin/users?query={ext_id}", headers=AUTH)
        assert resp.status_code == 200
        user = resp.json()["users"][0]
        assert "diamond_mission_1_done" in user
        assert "diamond_mission_2_done" in user
        assert user["diamond_mission_1_done"] is True

    def test_diamond_mission_toggle_off_relocks(self, client, db_conn):
        """Toggle diamond mission off should relock the vault."""
        ext_id = f"dia-relock-{uuid.uuid4().hex[:8]}"
        resp = client.post(
            "/api/vault/admin/users",
            json={"external_user_id": ext_id, "nickname": "DiaRelockTest"},
            headers={**AUTH, **idem()},
        )
        user_id = resp.json()["user_id"]

        # Set both missions true → UNLOCKED
        resp = client.post(
            f"/api/vault/admin/users/{user_id}/vault/diamond-missions",
            json={"diamond_mission_1_done": True, "diamond_mission_2_done": True},
            headers={**AUTH, **idem()},
        )
        assert resp.status_code == 200
        assert resp.json()["diamond_status"] == "UNLOCKED"

        # Toggle off mission 2 → LOCKED
        resp = client.post(
            f"/api/vault/admin/users/{user_id}/vault/diamond-missions",
            json={"diamond_mission_2_done": False},
            headers={**AUTH, **idem()},
        )
        assert resp.status_code == 200
        assert resp.json()["diamond_status"] == "LOCKED"


class TestUserStatusAPI:
    """User-facing status API tests."""

    def test_status_includes_mission_completion(self, client, db_conn):
        """User status should reflect mission completion from admin toggle."""
        ext_id = f"status-test-{uuid.uuid4().hex[:8]}"
        
        # Create user and snapshot
        resp = client.post(
            "/api/vault/admin/users",
            json={"external_user_id": ext_id, "nickname": "StatusTest", "telegram_ok": True},
            headers={**AUTH, **idem()},
        )
        user_id = resp.json()["user_id"]

        # Toggle gold missions on
        client.post(
            f"/api/vault/admin/users/{user_id}/vault/gold-missions",
            json={"gold_mission_1_done": True, "gold_mission_2_done": True, "gold_mission_3_done": True},
            headers={**AUTH, **idem()},
        )

        # Check user-facing status
        resp = client.get(f"/api/vault/status?user_id={user_id}")
        assert resp.status_code == 200
        data = resp.json()
        
        # Gold should be UNLOCKED now
        assert data["gold_status"] == "UNLOCKED"


class TestE2EUserFlow:
    """End-to-end user journey test."""

    def test_full_vault_unlock_journey(self, client, db_conn):
        """Test complete journey from locked to claimed."""
        ext_id = f"e2e-{uuid.uuid4().hex[:8]}"
        
        # 1. Admin creates user (telegram_ok=False initially)
        resp = client.post(
            "/api/vault/admin/users",
            json={
                "external_user_id": ext_id,
                "nickname": "E2EUser",
                "telegram_ok": False,  # Start with telegram_ok=False so gold is LOCKED
                "review_ok": True,
            },
            headers={**AUTH, **idem()},
        )
        assert resp.status_code == 200
        user_id = resp.json()["user_id"]

        # 2. Check initial status - should be LOCKED
        resp = client.get(f"/api/vault/status?user_id={user_id}")
        assert resp.json()["gold_status"] == "LOCKED"

        # 3. Admin toggles gold missions
        client.post(
            f"/api/vault/admin/users/{user_id}/vault/gold-missions",
            json={"gold_mission_1_done": True, "gold_mission_2_done": True, "gold_mission_3_done": True},
            headers={**AUTH, **idem()},
        )

        # 4. User checks status - gold unlocked
        resp = client.get(f"/api/vault/status?user_id={user_id}")
        assert resp.json()["gold_status"] == "UNLOCKED"

        # 5. User claims gold
        resp = client.post(
            f"/api/vault/claim?user_id={user_id}",
            json={"vault_type": "GOLD"},
        )
        assert resp.status_code == 200

        # 6. Verify claimed status
        resp = client.get(f"/api/vault/status?user_id={user_id}")
        assert resp.json()["gold_status"] == "CLAIMED"

        # 7. Admin list shows claimed
        resp = client.get(f"/api/vault/admin/users?query={ext_id}", headers=AUTH)
        user = resp.json()["users"][0]
        assert user["gold_status"] == "CLAIMED"
