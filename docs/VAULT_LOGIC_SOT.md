# Vault System Logic & Dependencies (SOT)

## Overview
This document defines the strict logic for Vault Status transitions, Admin Reversion capabilities, and Hierarchical Dependencies (Gold -> Platinum -> Diamond).

## Core Principles
1.  **Strict Dependency**: A higher-tier vault CANNOT be `UNLOCKED` or `CLAIMED` if the lower-tier vault is not `UNLOCKED` or `CLAIMED`.
    *   Platinum requires Gold to be `UNLOCKED` or `CLAIMED`.
    *   Diamond requires Platinum to be `UNLOCKED` or `CLAIMED`.
2.  **Admin Reversion ("Infinite Power")**:
    *   Admins can revert a `CLAIMED` status to `LOCKED` by unticking required missions.
    *   This reversion MUST cascade. If Gold is reverted to `LOCKED`, Platinum MUST also revert to `LOCKED` (even if it was `CLAIMED`).
3.  **Global Synchronization**: All changes (Admin Panel, User Status, API) must reflect the instantaneous state of these conditions.

## Vault Logic

### 1. Gold Vault
*   **Conditions**:
    *   Mission 1 (Telegram): boolean
    *   Mission 2 (Manager): boolean
    *   Mission 3 (Identity): boolean
*   **Status Logic**:
    *   IF `current_status` is `EXPIRED` -> `EXPIRED` (unless Admin Manually Extends/Resets)
    *   IF (M1 and M2 and M3) are TRUE -> `UNLOCKED`
    *   ELSE -> `LOCKED`
    *   *Note: If previously `CLAIMED` but Admin toggles a mission OFF, status becomes `LOCKED`.*

### 2. Platinum Vault
*   **Conditions**:
    *   **[NEW] Prerequisite**: Gold Vault Status is `UNLOCKED` or `CLAIMED`.
    *   Mission 1 (Deposit Total 200k): boolean
    *   Mission 2 (Deposit Count 3): boolean
*   **Status Logic**:
    *   IF `current_status` is `EXPIRED` -> `EXPIRED`
    *   IF **Prerequisite** is FALSE -> `LOCKED` (Overrides everything)
    *   IF (Prerequisite AND M1 AND M2) are TRUE -> `UNLOCKED`
    *   ELSE -> `LOCKED`

### 3. Diamond Vault
*   **Conditions**:
    *   **[NEW] Prerequisite**: Platinum Vault Status is `UNLOCKED` or `CLAIMED`.
    *   Mission 1 (Deposit Total 2m): boolean
    *   Mission 2 (Attendance 2 Days): boolean
*   **Status Logic**:
    *   IF `current_status` is `EXPIRED` -> `EXPIRED`
    *   IF **Prerequisite** is FALSE -> `LOCKED` (Overrides everything)
    *   IF (Prerequisite AND M1 AND M2) are TRUE -> `UNLOCKED`
    *   ELSE -> `LOCKED`

## Implementation Details
*   **Backend**: `compute_platinum_status` and `compute_diamond_status` MUST strictly enforce the dependency check.
*   **Cascade**: When `admin_update_gold_missions` is called, it must effectively trigger a re-eval of Platinum and Diamond statuses for that user.
*   **Frontend**: The "Prerequisite" should be visualized as a readonly (or auto) condition in the Admin Panel to show why a vault might be locked.
