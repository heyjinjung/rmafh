import pytest
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
