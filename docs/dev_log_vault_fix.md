# Dev Log: Vault Issue Troubleshooting (2025-01-10)

## 1. Platinum/Diamond Mission Toggle Issue

### Problem
In the Admin V2 panel, checking the "Mission 1 Done" or "Mission 2 Done" boxes for Platinum or Diamond users updated the checkbox state visually and in the database, but **did not change the Vault Status** from `LOCKED` to `UNLOCKED`, even if all other criteria (Deposit, Attendance) were met.

### Root Cause Analysis
1.  **Backend Logic Gap**: The `compute_platinum_status` and `compute_diamond_status` functions in `vault_service.py` did not accept mission flags (`m1`, `m2`) as arguments. They purely checked deposits and attendance.
2.  **Admin Router Disconnect**: The API endpoints (`admin_update_platinum_missions`, etc.) in `admin_vault.py` were only updating the mission boolean columns (`platinum_mission_1_done`, etc.) but were **not triggering a re-computation** of the overall status.

### Solution
1.  **Updated Service Layer**: Modified `compute_platinum_status` and `compute_diamond_status` to require mission flags to be `True` for an `UNLOCKED` status.
2.  **Updated Admin Router**: Modified the admin endpoints to:
    -   Fetch the current row state.
    -   Pass the new mission values + existing row data to the compute functions.
    -   Update the `platinum_status` / `diamond_status` columns if the computation result changed.
3.  **Standardized User Endpoint**: Also updated the user-facing `POST /attendance` endpoint to ensure it checks mission completion before unlocking Platinum.

---

## 2. Vault Time Unification (120 Hours)

### Problem
The vault expiry times were inconsistent across the application:
-   Frontend showed different countdowns for different tiers.
-   Backend default was 72 hours (3 days) for some, 120 hours for others.
-   Expiry was calculated from `now` in some places, leading to shifting deadlines.

### Root Cause
-   **Fragmented Constants**: Different files (`vaultConfig.js` vs `vault_config.py`) had diverging values.
-   **Floating Anchor**: Using `now + 120h` on every interaction meant a user could indefinitely extend their vault time.

### Solution
1.  **Unified SOT**: 
    -   Frontend: Set `VAULT_EXPIRY_HOURS` to **120** for all tiers in `lib/vaultConfig.js`.
    -   Backend: Set `DEFAULT_EXPIRY_HOURS` to **120** in `app/constants/vault_config.py`.
2.  **Fixed Anchor Date**:
    -   Changed logic to prefer `user_admin_snapshot.joined_date` as the start time.
    -   Expiry is now consistently `joined_date + 120 hours`.

---

## 3. Test Suite Fix (UnicodeDecodeError)

### Problem
Running tests on Windows resulted in a `UnicodeDecodeError` in `test_admin_gold_missions_v3.py`.

### Cause
The test file contained non-ASCII characters (likely Korean comments or output capture) that clashed with the Windows default encoding (CP949) when pytest attempted to read/report them.

### Solution
-   Sanitized `test_admin_gold_missions_v3.py` to be pure ASCII.
-   Added `# -*- coding: utf-8 -*-` header as a safeguard.
