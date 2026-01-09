"""
Test SOT (Source of Truth) Consistency

Verifies that Backend and Frontend SOT values match.
"""

import pytest
import subprocess
import json
import re

# Backend SOT imports
from app.constants.vault_config import (
    VAULT_REWARDS,
    VAULT_EXPIRY_HOURS,
    DEFAULT_EXPIRY_HOURS,
    PLATINUM_UNLOCK,
    DIAMOND_UNLOCK,
)


class TestSOTRewardAmounts:
    """Verify reward amounts match expected values."""
    
    def test_gold_reward(self):
        assert VAULT_REWARDS["GOLD"] == 10_000
    
    def test_platinum_reward(self):
        assert VAULT_REWARDS["PLATINUM"] == 30_000
    
    def test_diamond_reward(self):
        assert VAULT_REWARDS["DIAMOND"] == 300_000


class TestSOTExpiryHours:
    """Verify expiry hours match expected values."""
    
    def test_gold_expiry(self):
        assert VAULT_EXPIRY_HOURS["GOLD"] == 72
    
    def test_platinum_expiry(self):
        assert VAULT_EXPIRY_HOURS["PLATINUM"] == 72
    
    def test_diamond_expiry(self):
        assert VAULT_EXPIRY_HOURS["DIAMOND"] == 120  # 5 days
    
    def test_default_expiry(self):
        assert DEFAULT_EXPIRY_HOURS == 72


class TestSOTUnlockThresholds:
    """Verify unlock thresholds match expected values."""
    
    def test_platinum_deposit_total(self):
        assert PLATINUM_UNLOCK["deposit_total"] == 200_000
    
    def test_platinum_deposit_count(self):
        assert PLATINUM_UNLOCK["deposit_count"] == 3
    
    def test_diamond_deposit_total(self):
        assert DIAMOND_UNLOCK["deposit_total"] == 2_000_000
    
    def test_diamond_attendance_days(self):
        assert DIAMOND_UNLOCK["attendance_days"] == 2


class TestFrontendSOTConsistency:
    """
    Compare Backend SOT with Frontend SOT (vaultConfig.js).
    This test reads the frontend file and parses key values.
    """
    
    @pytest.fixture
    def frontend_sot_content(self):
        """Read frontend SOT file."""
        try:
            with open("/app/../frontend/lib/vaultConfig.js", "r", encoding="utf-8") as f:
                return f.read()
        except FileNotFoundError:
            pytest.skip("Frontend SOT file not accessible in test environment")
    
    def test_rewards_match(self, frontend_sot_content):
        """Check if reward values match between BE and FE."""
        # Extract VAULT_REWARDS from JS
        gold_match = re.search(r"GOLD:\s*(\d+(?:_\d+)*)", frontend_sot_content)
        platinum_match = re.search(r"PLATINUM:\s*(\d+(?:_\d+)*)", frontend_sot_content)
        diamond_match = re.search(r"DIAMOND:\s*(\d+(?:_\d+)*)", frontend_sot_content)
        
        if gold_match:
            fe_gold = int(gold_match.group(1).replace("_", ""))
            assert fe_gold == VAULT_REWARDS["GOLD"], f"Gold mismatch: FE={fe_gold}, BE={VAULT_REWARDS['GOLD']}"
        
        if platinum_match:
            fe_platinum = int(platinum_match.group(1).replace("_", ""))
            assert fe_platinum == VAULT_REWARDS["PLATINUM"], f"Platinum mismatch: FE={fe_platinum}, BE={VAULT_REWARDS['PLATINUM']}"
        
        if diamond_match:
            fe_diamond = int(diamond_match.group(1).replace("_", ""))
            assert fe_diamond == VAULT_REWARDS["DIAMOND"], f"Diamond mismatch: FE={fe_diamond}, BE={VAULT_REWARDS['DIAMOND']}"
    
    def test_expiry_hours_match(self, frontend_sot_content):
        """Check if expiry hours match between BE and FE."""
        # Diamond expiry should be 120 (5 days)
        diamond_expiry_match = re.search(r"DIAMOND:\s*(\d+)", frontend_sot_content.split("VAULT_EXPIRY_HOURS")[1] if "VAULT_EXPIRY_HOURS" in frontend_sot_content else "")
        
        if diamond_expiry_match:
            fe_diamond_expiry = int(diamond_expiry_match.group(1))
            assert fe_diamond_expiry == VAULT_EXPIRY_HOURS["DIAMOND"], f"Diamond expiry mismatch: FE={fe_diamond_expiry}, BE={VAULT_EXPIRY_HOURS['DIAMOND']}"
