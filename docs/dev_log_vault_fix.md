# Dev Log: Vault Issue Troubleshooting (2026-01-10)

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

---

## 4. 누적입금 CRUD 제거 (2026-01-10)

### 배경
미션 토글 방식 도입으로 누적입금(deposit) CRUD가 불필요해짐. 금고 해제는 이제 미션 토글로만 관리.

### 삭제 대상

#### Backend
| 파일 | 삭제 내용 |
|------|----------|
| `routers/admin_vault.py` | `POST /{user_id}/vault/deposit` 엔드포인트 전체 (~140줄) |
| `schemas.py` | `AdminDepositUpdateRequest`, `AdminDepositUpdateResponse` 클래스 |
| `schemas.py` | `AdminBulkDepositUpdate` 클래스 |
| `schemas.py` | `AdminBulkUpdateRequest.deposit` 필드 |
| `main.py` | `AdminDepositUpdate*` import 제거 |
| `main.py` | `admin_bulk_update` 내 `has_deposit` 로직 전체 |

#### Frontend
| 파일 | 삭제 내용 |
|------|----------|
| `AdminV2UsersGrid.jsx` | `columnDefs`에서 `deposit_total` 열 |
| `AdminV2UsersGrid.jsx` | `sortableKeys`에서 `deposit_total` |
| `AdminV2UsersGrid.jsx` | `depositSaving`, `platinumDepositDone`, `diamondDepositCurrent` state |
| `AdminV2UsersGrid.jsx` | form에서 `deposit_total` 필드 |
| `AdminV2UsersGrid.jsx` | `submitDepositUpdate` 함수 전체 |
| `AdminV2UsersGrid.jsx` | `vaultConfig` import (`PLATINUM_UNLOCK`, `DIAMOND_UNLOCK`) |
| `AdminV2UsersGrid.jsx` | `telegram_ok`/`review_ok` 렌더링 로직 |

### 결과
- ✅ Frontend lint 통과
- ✅ Backend 구문 오류 없음

---

## 5. 테스트 DB 초기화 문제 발견 (2026-01-10)

### 문제
CSV 업로드 후 로그인 시 `CSV_UPLOAD_REQUIRED` 오류 발생 - 사용자 데이터가 DB에 없음.

### 원인
`backend/tests/conftest.py`의 `_reset_db_state` fixture가 **autouse=True**로 설정되어 있어 pytest 실행 시 모든 사용자 데이터 삭제:
```python
cur.execute("DELETE FROM user_admin_snapshot")
cur.execute("DELETE FROM vault_status")
cur.execute("DELETE FROM user_identity")
```

### 영향
- 테스트와 개발 환경이 **같은 DB 공유**
- pytest 실행할 때마다 **프로덕션 데이터 삭제**

### 임시 조치
- 테스트 데이터 재업로드
- conftest.py에 `APP_ENV=test` 조건 추가 시도 (추가 검증 필요)

### 권장 해결책
1. 테스트용 별도 DB 사용 (`vault_test` 등)
2. 또는 `_reset_db_state`를 테스트 환경에서만 실행되도록 수정

---

## 6. 가입일 편집 테스트 추가 (2026-01-10)

### 배경
어드민에서 사용자 가입일(`joined_date`) 편집 기능의 테스트 필요

### 추가된 테스트
- `backend/tests/test_admin_users_joined_date.py` (8개 테스트)
  - 정상 업데이트 테스트
  - 유효성 검증 (미래 날짜, 잘못된 형식 등)
  - 멱등키 테스트
  - NULL 처리 테스트

### 결과
- ✅ 8개 테스트 모두 통과

---

## 7. 미션 토글 전체 통합 테스트 추가 (2026-01-10)

### 배경
어드민에서 미션 토글 저장 후:
1. 어드민 사용자 패널에 반영 안됨 (플래티넘/다이아)
2. 유저 페이지 금고 조건에 반영 안됨

### 원인 분석
- `admin_users.py`의 사용자 목록 API에서 `platinum_mission_*`, `diamond_mission_*` 필드가 SELECT 및 응답에서 누락
- 서비스 레이어 `compute_*_status` 함수 시그니처에 `m1`, `m2` 인자 추가 후 테스트 미반영

### 수정 내용

#### 1. admin_users.py - 사용자 목록 API 수정
```python
# SELECT 쿼리에 미션 필드 추가
vs.platinum_mission_1_done,
vs.platinum_mission_2_done,
vs.diamond_mission_1_done,
vs.diamond_mission_2_done,

# 응답 객체에 매핑 추가
"platinum_mission_1_done": bool(row[19]),
"platinum_mission_2_done": bool(row[20]),
"diamond_mission_1_done": bool(row[21]),
"diamond_mission_2_done": bool(row[22]),
```

#### 2. test_service_layer.py - 서비스 레이어 테스트 수정
```python
# compute_platinum_status에 m1, m2 인자 추가
result = compute_platinum_status(
    deposit_total=200_000,
    deposit_count=3,
    attendance_days=3,
    review_ok=True,
    m1=True,  # 추가
    m2=True,  # 추가
    gold_status="CLAIMED",
    current_status="LOCKED",
)

# compute_diamond_status에 m1, m2 인자 추가
result = compute_diamond_status(
    deposit_total=2_000_000,
    attendance_days=2,
    m1=True,  # 추가
    m2=True,  # 추가
    platinum_status="CLAIMED",
    current_status="LOCKED",
)
```

#### 3. test_sot_consistency.py - SOT 만료시간 업데이트
```python
# 72시간 → 120시간 (5일) 통일
def test_gold_expiry(self):
    assert VAULT_EXPIRY_HOURS["GOLD"] == 120  # 5 days

def test_platinum_expiry(self):
    assert VAULT_EXPIRY_HOURS["PLATINUM"] == 120  # 5 days

def test_default_expiry(self):
    assert DEFAULT_EXPIRY_HOURS == 120  # 5 days
```

#### 4. test_admin_users.py - deposit 엔드포인트 테스트 제거
```python
# 삭제된 deposit 엔드포인트 대신 gold-missions 사용
gold_missions = client.post(
    f"/api/vault/admin/users/{user_id}/vault/gold-missions",
    json={"gold_mission_1_done": True, "gold_mission_2_done": True, "gold_mission_3_done": True},
    headers=_idem_headers(f"gold-missions-{ext}"),
)
```

### 추가된 테스트 파일
- `backend/tests/test_mission_toggle_full.py` (8개 테스트)
  - `TestGoldMissionToggle` - 골드 미션 토글 및 상태 변경
  - `TestPlatinumMissionToggle` - 플래티넘 미션 토글 및 사용자 목록 반영
  - `TestDiamondMissionToggle` - 다이아몬드 미션 토글 및 사용자 목록 반영
  - `TestUserStatusAPI` - 유저 상태 API 미션 반영
  - `TestE2EUserFlow` - E2E 전체 유저 플로우 (생성→토글→해금→수령)

### API 매핑 검증 결과

| API | 기능 | 반환 필드 | 상태 |
|-----|------|----------|------|
| `POST /admin/users/{id}/vault/gold-missions` | 골드 미션 토글 | `gold_mission_*_done`, `gold_status` | ✅ |
| `POST /admin/users/{id}/vault/platinum-missions` | 플래티넘 미션 토글 | `platinum_mission_*_done`, `platinum_status` | ✅ |
| `POST /admin/users/{id}/vault/diamond-missions` | 다이아몬드 미션 토글 | `diamond_mission_*_done`, `diamond_status` | ✅ |
| `GET /admin/users` | 사용자 목록 | 모든 미션 필드 포함 | ✅ |
| `GET /status` | 유저 상태 | `gold/platinum/diamond_status` 반영 | ✅ |

### 최종 테스트 결과
- **109개 통과, 6개 스킵**
- Frontend lint 통과 ✅

---

## 8. 출석일수 표시 기능 삭제 (2026-01-10)

### 변경 내용
어드민 사용자 패널에서 출석일수 컬럼 제거

### 수정 파일
- `frontend/components/admin-v2/AdminV2UsersGrid.jsx`
  - `columnDefs`에서 `{ key: 'platinum_attendance_days', label: '출석(일)' }` 삭제

### 결과
- ✅ Frontend lint 통과
---

## 9. 엄격한 금고 의존성 및 어드민 연동 구현 (2026-01-10)

### 배경
사용자가 'CLAIMED' 상태인 금고를 어드민에서 미션을 취소해도 상태가 'LOCKED'로 돌아가지 않는 문제와, 하위 금고 잠금 시 상위 금고가 자동으로 잠기지 않는 문제 발생.

### 수정 내용
1.  **Strict Source of Truth (SOT) 적용**: `vault_service.py`에서 상위 금고(Platinum, Diamond) 계산 시 하위 금고의 상태(`UNLOCKED` or `CLAIMED`)를 **필수 조건**으로 검사하도록 변경.
2.  **Cascade Update 구현**: `admin_vault.py`에서 골드 미션 수정 시 플래티넘/다이아 상태도 즉시 재계산하여 DB에 반영.
3.  **Admin UI 개선**: `AdminV2UsersGrid.jsx`에 '골드 금고 해제', '플래티넘 금고 해제' 선행 조건을 읽기 전용 미션으로 표시하여 의존성 시각화.

### 결과
- 어드민에서 하위 금고 미션 해제 시 즉시 상위 금고까지 모두 `LOCKED`로 전환됨 확인.

---

## 10. 금고 수령 무한 루프 수정 (2026-01-10)

### 문제
사용자가 금고 수령 버튼 클릭 시 네트워크 요청이 무한 반복되며 모달이 계속 깜빡이는 현상.

### 원인
1.  `frontend/pages/index.jsx`의 `claimVault` 함수에 **중복 실행 방지 가드(Running Guard)**가 없었음.
2.  `handleVaultSelect` 함수가 정의되지 않아 렌더링 사이클 중 에러 유발 가능성.
3.  상태 갱신과 모달 오픈 로직이 맞물려 리렌더링 루프 발생.

### 해결책
1.  `isClaiming` 상태 변수를 추가하여 `claimVault` 실행 중 중복 호출 방지.
2.  누락된 `handleVaultSelect` 함수 정의.

### 결과
- 금고 수령 버튼 클릭 시 정확히 한 번만 API 요청이 발생하며 모달이 안정적으로 뜸.

---

## 11. 애니메이션 성능 최적화 (2026-01-10)

### 문제
각 금고의 3D 아이콘과 보상 배지 애니메이션이 페이지 타이머(1초)마다 버벅거림(Stuttering).

### 원인
`VaultIcon`, `RewardBadge`, `VaultResultModal` 등의 컴포넌트가 `VaultChallenge` 컴포넌트 **내부**에 정의되어 있어, 1초마다 상위 컴포넌트가 리렌더링될 때마다 이들 하위 컴포넌트도 **매번 새로 생성(Unmount -> Mount)**됨. 이로 인해 브라우저가 이미지를 다시 로드하고 DOM을 재생성함.

### 해결책
- 내부 정의된 컴포넌트(`VaultIcon`, `RewardBadge`, `VaultResultModal`)와 헬퍼 함수(`getVaultColorScheme`, `formatCurrency`)를 모두 `VaultChallenge` **외부(모듈 스코프)**로 이동.

### 결과
- 타이머가 갱신되어도 하위 컴포넌트가 재생성되지 않으므로 애니메이션이 끊김 없이 부드럽게 작동함.
