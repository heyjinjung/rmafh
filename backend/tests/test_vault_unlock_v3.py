"""
Test V3 Vault Unlock Conditions

Tests for:
- Platinum unlock: deposit_total >= 200,000 AND deposit_count >= 3 AND gold_claimed
- Diamond unlock: deposit_total >= 2,000,000 (simplified, per SOT)
- Gold unlock: telegram_ok = True
"""

import pytest
from app.constants.vault_config import (
    PLATINUM_UNLOCK,
    DIAMOND_UNLOCK,
    check_gold_unlock,
    check_platinum_unlock,
    check_diamond_unlock,
)


class TestGoldUnlock:
    """Gold unlock is based solely on telegram_ok."""
    
    def test_gold_unlocks_with_telegram_ok_true(self):
        assert check_gold_unlock(telegram_ok=True) is True
    
    def test_gold_stays_locked_with_telegram_ok_false(self):
        assert check_gold_unlock(telegram_ok=False) is False


class TestPlatinumUnlock:
    """Platinum unlock requires: deposit >= 200k, count >= 3, gold claimed."""
    
    def test_platinum_unlocks_when_all_conditions_met(self):
        result = check_platinum_unlock(
            deposit_total=200_000,
            deposit_count=3,
            gold_claimed=True,
        )
        assert result is True
    
    def test_platinum_stays_locked_if_deposit_insufficient(self):
        result = check_platinum_unlock(
            deposit_total=199_999,  # Just under threshold
            deposit_count=3,
            gold_claimed=True,
        )
        assert result is False
    
    def test_platinum_stays_locked_if_count_insufficient(self):
        result = check_platinum_unlock(
            deposit_total=200_000,
            deposit_count=2,  # Under threshold
            gold_claimed=True,
        )
        assert result is False
    
    def test_platinum_stays_locked_if_gold_not_claimed(self):
        result = check_platinum_unlock(
            deposit_total=200_000,
            deposit_count=3,
            gold_claimed=False,  # Gold not claimed
        )
        assert result is False
    
    def test_platinum_stays_locked_if_all_conditions_fail(self):
        result = check_platinum_unlock(
            deposit_total=0,
            deposit_count=0,
            gold_claimed=False,
        )
        assert result is False
    
    def test_platinum_threshold_values_match_sot(self):
        """Verify SOT constants are as expected."""
        assert PLATINUM_UNLOCK["deposit_total"] == 200_000
        assert PLATINUM_UNLOCK["deposit_count"] == 3


class TestDiamondUnlock:
    """Diamond unlock requires: deposit >= 2M, attendance >= 2, platinum claimed."""
    
    def test_diamond_unlocks_when_all_conditions_met(self):
        result = check_diamond_unlock(
            deposit_total=2_000_000,
            attendance_days=2,
            platinum_claimed=True,
        )
        assert result is True
    
    def test_diamond_stays_locked_if_deposit_insufficient(self):
        result = check_diamond_unlock(
            deposit_total=1_999_999,
            attendance_days=2,
            platinum_claimed=True,
        )
        assert result is False
    
    def test_diamond_stays_locked_if_attendance_insufficient(self):
        result = check_diamond_unlock(
            deposit_total=2_000_000,
            attendance_days=1,  # Under threshold
            platinum_claimed=True,
        )
        assert result is False
    
    def test_diamond_stays_locked_if_platinum_not_claimed(self):
        result = check_diamond_unlock(
            deposit_total=2_000_000,
            attendance_days=2,
            platinum_claimed=False,
        )
        assert result is False
    
    def test_diamond_threshold_values_match_sot(self):
        """Verify SOT constants are as expected."""
        assert DIAMOND_UNLOCK["deposit_total"] == 2_000_000
        assert DIAMOND_UNLOCK["attendance_days"] == 2
