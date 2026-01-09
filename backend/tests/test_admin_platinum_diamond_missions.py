"""Tests for platinum and diamond mission admin API endpoints."""
from uuid import uuid4


def _idem_headers(prefix: str = "test-missions"):
    return {"x-idempotency-key": f"{prefix}-{uuid4()}"}


class TestPlatinumMissions:
    """Test platinum mission toggle functionality."""

    def test_platinum_missions_toggle(self, client):
        """Test toggling platinum mission completion status."""
        create = client.post(
            "/api/vault/admin/users",
            json={
                "external_user_id": f"ext-pm-{uuid4()}",
                "nickname": "pm-user",
                "joined_date": "2024-01-01",
                "deposit_total": 0,
                "telegram_ok": False,
                "review_ok": False,
            },
            headers=_idem_headers("create"),
        )
        assert create.status_code == 200
        user_id = create.json()["user_id"]

        # Toggle mission 1
        r1 = client.post(
            f"/api/vault/admin/users/{user_id}/vault/platinum-missions",
            json={"platinum_mission_1_done": True},
            headers=_idem_headers("pm1"),
        )
        assert r1.status_code == 200
        assert r1.headers.get("Idempotency-Status") == "recorded"
        d1 = r1.json()
        assert d1["platinum_mission_1_done"] is True
        assert d1["platinum_mission_2_done"] is False
        assert d1["updated"] is True

        # Toggle mission 2
        r2 = client.post(
            f"/api/vault/admin/users/{user_id}/vault/platinum-missions",
            json={"platinum_mission_2_done": True},
            headers=_idem_headers("pm2"),
        )
        assert r2.status_code == 200
        d2 = r2.json()
        assert d2["platinum_mission_1_done"] is True
        assert d2["platinum_mission_2_done"] is True

    def test_platinum_missions_no_fields_error(self, client):
        """Test that empty request returns NO_FIELDS error."""
        create = client.post(
            "/api/vault/admin/users",
            json={
                "external_user_id": f"ext-pm-empty-{uuid4()}",
                "nickname": "pm-empty",
                "joined_date": "2024-01-01",
                "deposit_total": 0,
                "telegram_ok": False,
                "review_ok": False,
            },
            headers=_idem_headers("create-empty"),
        )
        assert create.status_code == 200
        user_id = create.json()["user_id"]

        r = client.post(
            f"/api/vault/admin/users/{user_id}/vault/platinum-missions",
            json={},
            headers=_idem_headers("empty"),
        )
        assert r.status_code == 400
        assert r.json()["detail"] == "NO_FIELDS"

    def test_platinum_missions_user_not_found(self, client):
        """Test that non-existent user returns USER_NOT_FOUND."""
        r = client.post(
            "/api/vault/admin/users/999999999/vault/platinum-missions",
            json={"platinum_mission_1_done": True},
            headers=_idem_headers("not-found"),
        )
        assert r.status_code == 404
        assert r.json()["detail"] == "USER_NOT_FOUND"


class TestDiamondMissions:
    """Test diamond mission toggle functionality."""

    def test_diamond_missions_toggle(self, client):
        """Test toggling diamond mission completion status."""
        create = client.post(
            "/api/vault/admin/users",
            json={
                "external_user_id": f"ext-dm-{uuid4()}",
                "nickname": "dm-user",
                "joined_date": "2024-01-01",
                "deposit_total": 0,
                "telegram_ok": False,
                "review_ok": False,
            },
            headers=_idem_headers("create-dm"),
        )
        assert create.status_code == 200
        user_id = create.json()["user_id"]

        # Toggle mission 1
        r1 = client.post(
            f"/api/vault/admin/users/{user_id}/vault/diamond-missions",
            json={"diamond_mission_1_done": True},
            headers=_idem_headers("dm1"),
        )
        assert r1.status_code == 200
        assert r1.headers.get("Idempotency-Status") == "recorded"
        d1 = r1.json()
        assert d1["diamond_mission_1_done"] is True
        assert d1["diamond_mission_2_done"] is False
        assert d1["updated"] is True

        # Toggle mission 2
        r2 = client.post(
            f"/api/vault/admin/users/{user_id}/vault/diamond-missions",
            json={"diamond_mission_2_done": True},
            headers=_idem_headers("dm2"),
        )
        assert r2.status_code == 200
        d2 = r2.json()
        assert d2["diamond_mission_1_done"] is True
        assert d2["diamond_mission_2_done"] is True

    def test_diamond_missions_no_fields_error(self, client):
        """Test that empty request returns NO_FIELDS error."""
        create = client.post(
            "/api/vault/admin/users",
            json={
                "external_user_id": f"ext-dm-empty-{uuid4()}",
                "nickname": "dm-empty",
                "joined_date": "2024-01-01",
                "deposit_total": 0,
                "telegram_ok": False,
                "review_ok": False,
            },
            headers=_idem_headers("create-dm-empty"),
        )
        assert create.status_code == 200
        user_id = create.json()["user_id"]

        r = client.post(
            f"/api/vault/admin/users/{user_id}/vault/diamond-missions",
            json={},
            headers=_idem_headers("dm-empty"),
        )
        assert r.status_code == 400
        assert r.json()["detail"] == "NO_FIELDS"

    def test_diamond_missions_user_not_found(self, client):
        """Test that non-existent user returns USER_NOT_FOUND."""
        r = client.post(
            "/api/vault/admin/users/999999999/vault/diamond-missions",
            json={"diamond_mission_1_done": True},
            headers=_idem_headers("dm-not-found"),
        )
        assert r.status_code == 404
        assert r.json()["detail"] == "USER_NOT_FOUND"


class TestMissionsIdempotency:
    """Test idempotency for mission endpoints."""

    def test_platinum_missions_idempotency_replay(self, client):
        """Test platinum missions idempotency replay."""
        create = client.post(
            "/api/vault/admin/users",
            json={
                "external_user_id": f"ext-pm-idem-{uuid4()}",
                "nickname": "pm-idem",
                "joined_date": "2024-01-01",
                "deposit_total": 0,
                "telegram_ok": False,
                "review_ok": False,
            },
            headers=_idem_headers("create-pm-idem"),
        )
        assert create.status_code == 200
        user_id = create.json()["user_id"]

        idem_key = f"pm-idem-replay-{uuid4()}"
        headers = {"x-idempotency-key": idem_key}

        r1 = client.post(
            f"/api/vault/admin/users/{user_id}/vault/platinum-missions",
            json={"platinum_mission_1_done": True},
            headers=headers,
        )
        assert r1.status_code == 200
        assert r1.headers.get("Idempotency-Status") == "recorded"

        # Replay with same idempotency key
        r2 = client.post(
            f"/api/vault/admin/users/{user_id}/vault/platinum-missions",
            json={"platinum_mission_1_done": True},
            headers=headers,
        )
        assert r2.status_code == 200
        assert r2.headers.get("Idempotency-Status") == "replayed"
        assert r1.json() == r2.json()

    def test_diamond_missions_idempotency_replay(self, client):
        """Test diamond missions idempotency replay."""
        create = client.post(
            "/api/vault/admin/users",
            json={
                "external_user_id": f"ext-dm-idem-{uuid4()}",
                "nickname": "dm-idem",
                "joined_date": "2024-01-01",
                "deposit_total": 0,
                "telegram_ok": False,
                "review_ok": False,
            },
            headers=_idem_headers("create-dm-idem"),
        )
        assert create.status_code == 200
        user_id = create.json()["user_id"]

        idem_key = f"dm-idem-replay-{uuid4()}"
        headers = {"x-idempotency-key": idem_key}

        r1 = client.post(
            f"/api/vault/admin/users/{user_id}/vault/diamond-missions",
            json={"diamond_mission_1_done": True},
            headers=headers,
        )
        assert r1.status_code == 200
        assert r1.headers.get("Idempotency-Status") == "recorded"

        # Replay with same idempotency key
        r2 = client.post(
            f"/api/vault/admin/users/{user_id}/vault/diamond-missions",
            json={"diamond_mission_1_done": True},
            headers=headers,
        )
        assert r2.status_code == 200
        assert r2.headers.get("Idempotency-Status") == "replayed"
        assert r1.json() == r2.json()
