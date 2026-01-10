import pytest
import sys
import os
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app.services.vault_service import compute_gold_status, compute_platinum_status, compute_diamond_status

def test_reproduce_gold_revert_issue():
    """Reproduce the issue where Gold Status=CLAIMED cannot be reverted by toggling missions."""
    # Current state: CLAIMED
    current_status = "CLAIMED"
    
    # Action: Admin toggles a mission OFF (so not all are done)
    m1, m2, m3 = True, True, False # m3 is False
    
    # Expected: Should be LOCKED
    # Actual in Service: Service computes UNLOCKED/LOCKED correctly?
    new_status = compute_gold_status(m1, m2, m3, current_status)
    print(f"Gold: Current={current_status}, Missions={m1, m2, m3} -> New={new_status}")
    
    # Note: The issue is likely in admin_vault.py preventing the DB update, 
    # but let's check if service logic itself is sticky for CLAIMED.
    assert new_status == "LOCKED", f"Gold failed to revert! Got {new_status}"

def test_reproduce_platinum_revert_issue():
    """Check Platinum revert logic."""
    current_status = "CLAIMED"
    m1, m2 = True, False # Toggled OFF
    
    # Platinum logic in service
    # compute_platinum_status(deposit_total, deposit_count, attendance, review_ok, m1, m2, gold_status, current_status)
    new_status = compute_platinum_status(
        deposit_total=1000000, deposit_count=10, attendance_days=10, review_ok=True,
        m1=m1, m2=m2, gold_status="CLAIMED", current_status=current_status
    )
    print(f"Platinum: Current={current_status}, Missions={m1, m2} -> New={new_status}")
    
    assert new_status == "LOCKED", f"Platinum failed to revert! Got {new_status}"

if __name__ == "__main__":
    try:
        test_reproduce_gold_revert_issue()
        print("Gold Service Logic: OK (Issue is likely in Router level)")
    except AssertionError as e:
        print(f"Gold Service Logic: FAILED - {e}")

    try:
        test_reproduce_platinum_revert_issue()
        print("Platinum Service Logic: OK")
    except AssertionError as e:
        print(f"Platinum Service Logic: FAILED - {e}")

def test_strict_dependency():
    """Verify that Platinum locks if Gold is LOCKED, even if all Platinum missions are done."""
    # Scenario: User has done all Platinum missions
    # BUT Gold was reverted to LOCKED
    current_status = "CLAIMED"
    gold_status = "LOCKED" # Prerequisite NOT Met
    
    new_status = compute_platinum_status(
        deposit_total=1000000, deposit_count=10, attendance_days=10, review_ok=True,
        m1=True, m2=True, # Missions DONE
        gold_status=gold_status, 
        current_status=current_status
    )
    print(f"Dependency Test: Gold={gold_status}, PlatMissions=Done -> PlatStatus={new_status}")
    assert new_status == "LOCKED", f"Strict Dependency Failed! Platinum should be LOCKED but got {new_status}"

    # Scenario: Diamond locks if Platinum is LOCKED
    plat_status = "LOCKED"
    new_dia_status = compute_diamond_status(
        deposit_total=2000000, attendance_days=5,
        m1=True, m2=True,
        platinum_status=plat_status,
        current_status="CLAIMED"
    )
    print(f"Dependency Test: Platinum={plat_status}, DiaMissions=Done -> DiaStatus={new_dia_status}")
    assert new_dia_status == "LOCKED", f"Strict Dependency Failed! Diamond should be LOCKED but got {new_dia_status}"

if __name__ == "__main__":
    try:
        test_reproduce_gold_revert_issue()
        print("Gold Service Logic: OK")
    except AssertionError as e:
        print(f"Gold Service Logic: FAILED - {e}")

    try:
        test_reproduce_platinum_revert_issue() # This tests Mission Revert
        print("Platinum Mission Revert Logic: OK")
    except AssertionError as e:
        print(f"Platinum Mission Revert Logic: FAILED - {e}")

    try:
        test_strict_dependency() # This tests Prerequisite Revert
        print("Strict Dependency Logic: OK")
    except AssertionError as e:
        print(f"Strict Dependency Logic: FAILED - {e}")
