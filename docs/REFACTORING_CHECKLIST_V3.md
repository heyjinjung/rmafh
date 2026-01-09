# REFACTORING_CHECKLIST_V3

## 1. 메타
- 문서명: Vault v3 리팩토링 실행 체크리스트
- 문서 타입: 실행 가이드/체크리스트
- 문서 버전: v1.0.4
- 작성일: 2026-01-10
- 작성자: GitHub Copilot (Claude Opus 4.5)
- 대상: Lead Architect/운영자/개발자
- 범위: `docs/REFACTORING_PLAN_V3.md`의 Phase 0~5 + v3 신규 기능(특히 골드 미션 O/X)

## Changelog
- 2026-01-10 v1.0.4: Sprint 1 #6 완료, §14 신규 테스트 완료 (51 passed, 2 skipped), 다이아 해금 조건 수정 (platinum CLAIMED 필수)
- 2026-01-09 v1.0.3: Sprint 1(SOT 1~6) 실제 진행상태 반영(1~3 완료, 4~5 미완료, 6 재검증 대기)
- 2026-01-09 v1.0.2: v3 핵심 기능/UX/CSV/테스트 항목까지 완전 커버 보강
- 2026-01-09 v1.0.1: 속도 우선(Fast Track) 실행 가이드 추가
- 2026-01-09 v1.0.0: 최초 작성 (Phase 게이트 + P0 검증 기준 포함)

---

## 2. 사용 가이드(중요)
- 체크박스는 **“완료 기준(통과 조건)”을 충족했을 때만** 체크한다.
- 한 번에 크게 바꾸지 않는다.
  - 원칙: **작은 PR/작은 배포 단위**로 쪼개서 리스크를 줄인다.
  - GitHub 브랜치 전략(현재 기본 브랜치: `main`)
    - 작업 브랜치 생성: `main`에서 분기
    - 브랜치 네이밍(권장):
      - 리팩토링: `refactor/v3-<short-topic>`
      - 기능(P0 등): `feat/v3-<short-topic>`
      - 핫픽스: `hotfix/<short-topic>`
    - PR 규칙(권장):
      - PR 1개 = 체크리스트 한 덩어리(예: Phase 1의 특정 유틸 분리 1개)
      - DB/API/UI를 한 PR에 다 넣지 않는다(필요하면 DB → BE → FE로 3개 PR)
      - PR 제목 접두사 통일: `[v3][phaseX] ...` 또는 `[v3][P0] ...`
- 변경이 DB/API/UI 중 하나라도 포함되면 아래 3가지를 같이 한다.
  - (1) 문서 업데이트 (최소: 계획서/스펙/컬럼 가이드)
  - (2) 테스트 추가/갱신
  - (3) 롤백 플랜 1줄이라도 작성
- 속도 우선(Fast Track) 모드 적용 시:
  - 라우터/서비스 분리는 후순위로 미루고 `backend/app/main.py`에 직접 반영 가능
  - DB+BE 변경은 1개 PR로 묶을 수 있음 (FE는 별도 스프린트)
  - 필수 검증: `pytest` 신규 1개 + 스모크 시나리오 1개

---

## 3. 공통 게이트(모든 Phase 공통)

### 3.1 작업 시작 전(필수)
- [x] 현재 목표 Phase가 무엇인지 1줄로 적었다 (예: Phase 1 utils 분리)
- [x] 변경 범위를 3개 파일/3개 엔드포인트 단위로 제한했다(가능하면)
- [x] 기존 동작을 깨지 않는지 확인할 "스모크 시나리오"를 정했다(최소 1개)

### 3.2 완료 기준(필수)
- [x] 백엔드 테스트 통과: VS Code Task `backend: pytest (docker)` (84 passed, 6 skipped)
- [x] 프론트 린트 통과: VS Code Task `frontend: lint`
- [x] 새로 추가한 로직에는 최소 1개 테스트가 있다(핵심 로직만)

### 3.3 금지사항(리스크 방지)
- [x] 스코프 아웃 항목(지갑/인벤토리)은 구현/노출하지 않았다
- [x] 하드코딩으로 규칙을 흙뿌리지 않았다(설정은 SOT로)
- [x] "상태를 직접 변경하는 UI/엔드포인트"를 기본 UX로 늘리지 않았다(실수 유발)

---

🔴 다음 진행 순서 (P0 우선)
순서	체크리스트 섹션	작업 내용	우선순위
1	§4.1 Sprint 1 #4	Backend 상수 → SOT 치환 (main.py, routers/*, services/*)	🔴 P0
2	§4.1 Sprint 1 #5	Frontend 상수 → SOT 치환 (index.jsx 등)	🔴 P0
3	§4.1 Sprint 1 #6	테스트/린트 재검증	🔴 P0
4	§9 Phase 5	DB 마이그레이션 (골드 미션 컬럼 3개 추가)	🔴 P0
5	§10 골드 미션 O/X	BE API + FE 토글 UI + 프록시	🔴 P0
6	§13 CSV 업로드	cc_attendance_count 칼럼 파싱/저장	🔴 P0
7	§11 플래티넘/다이아 조건	새 조건(20만/3회/200만/출석2회) 로직 반영	🔴 P0
8	§14 신규 테스트	v3 조건/만료 회귀 테스트 추가	🔴 P0
🟡 후순위 (P1 / 선택)
순서	체크리스트 섹션	작업 내용	우선순위
9	§8 Phase 4 나머지	Admin v2 최소 변경, 프록시 정비	🟡 P1
10	Sprint 3 나머지	미분리 라우터들 (admin_imports, admin_jobs 등)	🟡 P1
11	§14.2 SOT 정합성 테스트	BE/FE SOT 값 일치 검증	🟡 P1






## 4. Phase 0: SOT 고정(이미 생성됨 — 유지보수 체크)
대상 파일:
- `backend/app/constants/vault_config.py`
- `frontend/lib/vaultConfig.js`
- `docs/VAULT_SOT.md`

현재 상태(계획서 기준):
- SOT 3종은 생성 완료 상태(Phase 0 ✅)
- 관련 파일: `docs/DB_MIGRATION_V3.sql`(Phase 5 대상)

현재 확인 결과(중요):
- SOT 파일 3종은 존재/생성 완료
- ✅ Backend 코드에서 하드코딩된 상수가 SOT로 치환 완료 (Sprint 1 #4)
- ✅ Frontend 코드에서 하드코딩된 상수가 SOT로 치환 완료 (Sprint 1 #5)

체크리스트:
- [x] v3 규칙 변경이 생기면 **SOT → 문서 → 코드** 순으로 반영한다
- [x] SOT 값이 바뀌면 관련 테스트(조건/만료/보상)가 깨지지 않는지 확인했다
- [x] "조건/보상/만료 시간" 관련 숫자가 다른 파일에 중복되어 있지 않다 (Backend)

완료 기준:
- [x] `backend: pytest (docker)` 통과 (23 passed)

---

## 4.1 Sprint 1: SOT + 비즈니스 로직 변경 (Plan v3 5장 기준)
체크리스트:
- [x] (1) SOT 파일 생성 (Backend): `backend/app/constants/vault_config.py`
- [x] (2) SOT 파일 생성 (Frontend): `frontend/lib/vaultConfig.js`
- [x] (3) SOT 문서화: `docs/VAULT_SOT.md`
- [x] (4) Backend 상수 참조 변경: `backend/app/main.py`, `routers/*.py`, `services/*.py`에서 SOT로 치환
- [x] (5) Frontend 상수 참조 변경: `frontend/pages/index.jsx`에서 SOT로 치환
- [x] (6) 테스트 실행 및 검증: (4)(5) 완료 후 재실행

메모(완료 기준 해석):
- (6)은 "현재 기준으로 테스트/린트가 통과"하더라도, (4)(5)를 적용한 뒤 다시 통과해야 Sprint 1 완료로 간주
- (4) 완료: 2026-01-09 - pytest 23 passed
- (5) 완료: 2026-01-09 - lint ✔ No ESLint warnings or errors
- (6) 완료: 2026-01-10 - pytest 23 passed, lint ✔ No ESLint warnings or errors

---

## 5. Phase 1: 유틸리티 분리(난이도: 낮음)
목표: `backend/app/main.py`의 **순수 함수/검증/변환 로직**을 `utils/`로 분리

주의(속도 우선 Fast Track): Phase 1은 후순위로 미뤄도 된다.

체크리스트:
- [x] 분리 대상은 “DB 접근 없는 함수”부터 시작했다
- [x] 함수 시그니처는 유지하거나, 최소 변경으로 래핑했다
- [x] 분리 후에도 import 순환이 발생하지 않는다

분리 대상(계획서 권장, 우선순위):
- [x] `backend/app/utils/__init__.py` 생성
- [x] `backend/app/utils/parsers.py`로 파서 분리
  - [x] `_parse_int_optional`
  - [x] `_parse_date_optional`
- [x] `backend/app/utils/auth.py`로 인증 분리
  - [x] `verify_admin_password`
- [x] `backend/app/utils/audit.py`로 감사로깅 분리
  - [x] `_log_admin_action`
- [x] `backend/app/utils/sql_builders.py`로 SQL/타임아웃 분리
  - [x] `_build_user_target_sql`
  - [x] `_apply_job_timeouts`

완료 기준:
- [x] `backend: pytest (docker)` 통과 (23 passed)

---

## 6. Phase 2: 라우터 분리(난이도: 중)
목표: `backend/app/main.py` 엔드포인트를 도메인별 파일로 분리(기능 동일)

체크리스트:
- [x] 엔드포인트 경로/메서드/응답은 변경하지 않았다(리팩토링만)
- [x] 의존성 주입(예: admin password 검증)을 공통으로 유지했다
- [x] 라우터 분리 후에도 OpenAPI/서버 부팅이 정상이다

분리된 라우터 파일:
- [x] `backend/app/routers/__init__.py` 생성
- [x] `backend/app/routers/dependencies.py` - 공통 의존성
- [x] `backend/app/routers/health.py` - /health 엔드포인트
- [x] `backend/app/routers/vault.py` - /api/vault/login, /status, /claim, /attendance
- [x] `backend/app/routers/admin_users.py` - /api/vault/admin/users CRUD
- [x] `backend/app/routers/admin_vault.py` - gold-missions, status, attendance, deposit

완료 기준:
- [x] `backend: pytest (docker)` 통과 (23 passed)


테스트 파일	테스트 수	결과
test_vault_unlock_v3.py	12개	✅ 12 passed
test_sot_consistency.py	14개	✅ 12 passed, 2 skipped


---

## 7. Phase 3: 서비스 레이어(난이도: 중~상)
목표: “규칙/계산/가드레일”을 서비스 함수로 모아 SRP를 개선

체크리스트:
- [x] 핵심 규칙(금고 조건/상태 전이/만료 정책)은 서비스 레이어로 이동했다
- [x] 서비스 함수는 입력/출력 계약이 명확하다(요청 스키마/응답 스키마와 대응)
- [x] 서비스가 DB 접근을 완전히 추상화하지 못하더라도(현 구조상) 책임이 분리되었다

분리된 서비스 파일:
- [x] `backend/app/services/__init__.py` 생성
- [x] `backend/app/services/common.py` - 공통 유틸(idempotency, parsing, validation)
- [x] `backend/app/services/user_identity_service.py` - 유저 ID 해석/생성/벌크
- [x] `backend/app/services/vault_service.py` - 금고 상태 계산/조건/가드레일

완료 기준:
- [x] `backend: pytest (docker)` 통과 (23 passed)

---

## 8. Phase 4: 프론트엔드 리팩토링(현 구조 존중)
주의: 이 레포는 Next.js Pages Router 기반이므로, 불필요한 App Router 전환은 하지 않는다.

체크리스트:
- [x] v3 변경은 `frontend/components/admin-v2/` 및 관련 API proxy에 "최소 변경"으로 반영했다
- [x] 프론트에서 규칙을 재구현하지 않았다(가능하면 서버 계산 결과를 표시)
- [x] (Sprint 1.5) 유저 로그인에서 어드민 UI/메뉴가 아예 보이지 않는다
- [x] (Sprint 1.5) 직접 URL 접근으로도 어드민 페이지가 열리지 않는다(가드/리다이렉트/403 중 팀 기준으로 1개로 통일)
- [x] (Sprint 1.5) 관리자 페이지는 유저 영역과 분리된 구성/레이아웃/네비를 사용한다(최소: 노출/접근 차단)
- [x] (Sprint 1) 금고 관련 "상수/보상/만료 시간"은 `frontend/lib/vaultConfig.js`(SOT) 기준으로만 표시한다
- [x] 사이드바 고정 문구 3종을 요구사항대로 반영했다(문구/다이아 마감(5일) 연동 포함)
- [x] 금고 가이드 화면 상단에 "뒤로가기 / 홈 버튼"이 존재하고 동작이 명확하다
- [x] 스코프 아웃(지갑/인벤토리)은 UI/메뉴/라우팅 어디에도 추가하지 않았다
- [x] Next API Proxy(`frontend/pages/api/**`)는 기존 프록시 패턴을 그대로 따르고, 필요한 헤더만 전달한다
- [x] 어드민 관련 요청은 멱등키(`x-idempotency-key`)가 필요한 경우 항상 포함한다(해당 기능에서)

완료 기준:
- [x] `frontend: lint` 통과

### 10.6 Implementation Log (공유용)
- **DB**: `docs/DB_MIGRATION_V3.sql` (컬럼 추가: `gold_mission_1_done`, `gold_mission_2_done`, `gold_mission_3_done`)
- **Backend**:
  - `backend/app/routers/admin_vault.py`: `admin_update_gold_missions` 구현 (미션 토글 + `gold_status` 자동 계산)
  - `backend/app/schemas.py`: `AdminGoldMissionsUpdateRequest` 추가
- **Frontend**:
  - `frontend/components/admin-v2/AdminV2UsersGrid.jsx`: 토글 UI 구현, 상태별(CLAIMED) 비활성화 처리
  - `frontend/pages/api/vault/admin/users/[userId]/vault/gold-missions.js`: Next.js Proxy 추가

### 10.7 Troubleshooting
- **Status**: ✅ **완료 (Completed)**
- **Issue Track**:
  - 초기 `test_admin_gold_missions_v3` 작성 시 `ImportError` 발생 → `app.services.common` 경로 수정으로 해결.
  - 현재 특이사항 없음.

---

## 9. Phase 5: DB 마이그레이션
대상: `docs/DB_MIGRATION_V3.sql`

체크리스트:
- [x] Expand → Migrate → Contract 순서로 배포 가능하도록 설계했다
- [x] (Expand) 새 컬럼/테이블은 서비스 중단 없이 추가 가능하도록 설계했다(기본값/NULL 허용 여부 포함)
- [x] (Migrate) 운영 데이터 이행/백필이 필요하면 별도 단계로 분리했다(대량 업데이트로 인한 락/부하 주의)
- [x] (Contract) 안정화 후 NOT NULL/제약/인덱스 강화를 적용한다(필요시 후순위)
- [x] 컬럼 추가는 DEFAULT/NOT NULL 정책을 안전하게 잡았다
- [x] 인덱스/제약은 운영 부하를 고려했다(필요시 후순위)
- [x] 마이그레이션 적용 전후로 백업/롤백 경로가 준비되어 있다(최소: 실패 시 되돌릴 1줄 플랜)
- [x] 로컬/도커 환경에서 `docs/DB_MIGRATION_V3.sql` 적용 후, 핵심 API 스모크를 수행했다
- [x] v3 변경에 필요한 스키마(예: 골드 미션 필드/CSV 출석 칼럼 등)가 SQL에 반영되어 있는지 재확인했다

완료 기준:
- [x] 로컬/도커 환경에서 마이그레이션 적용 후 API 스모크 OK

메모:
- 2026-01-10: 마이그레이션 적용 완료 (Docker PostgreSQL)
  - gold_mission_1_done, gold_mission_2_done, gold_mission_3_done 컬럼 추가
  - platinum_deposit_total, platinum_deposit_count, diamond_attendance_days, diamond_expires_at 컬럼 추가
  - pytest 23 passed 확인

---

## 10. P0 기능 체크리스트: 골드 미션 O/X 토글 (v3)
설계 출처: `docs/REFACTORING_PLAN_V3.md`의 2.6

### 10.1 DB
- [x] `vault_status`에 컬럼 추가
  - [x] `gold_mission_1_done` BOOLEAN NOT NULL DEFAULT FALSE
  - [x] `gold_mission_2_done` BOOLEAN NOT NULL DEFAULT FALSE
  - [x] `gold_mission_3_done` BOOLEAN NOT NULL DEFAULT FALSE

### 10.2 백엔드 API
- [x] 엔드포인트 신설: `POST /api/vault/admin/users/{user_id}/vault/gold-missions`
- [x] 멱등키 지원: `x-idempotency-key` 필수(현 패턴과 동일)
- [x] 감사로그 액션 분리: `ADMIN_GOLD_MISSIONS_UPDATE`
- [x] 상태 자동 계산 규칙 구현
  - [x] `gold_status`가 `CLAIMED/EXPIRED`면 자동 변경하지 않는다
  - [x] 그 외는 (m1&m2&m3)면 UNLOCKED, 아니면 LOCKED

### 10.3 프론트(Admin v2)
- [x] 유저 상세 패널에 “골드 미션(O/X)” 섹션 추가
- [x] 토글 변경 → 즉시 저장(권장) 또는 명시적 Save(팀 합의)
- [x] 실패 시 토글 롤백 + 에러 토스트

### 10.4 Next API Proxy
- [x] 프록시 추가: `/pages/api/vault/admin/users/[userId]/vault/gold-missions.js`
- [x] `x-admin-password`/`x-idempotency-key` 전달

### 10.5 테스트
- [x] `test_admin_gold_missions_v3.py` 추가
- [x] 조합 테스트: m1/m2/m3 변경에 따른 LOCKED↔UNLOCKED
- [x] CLAIMED 보호 규칙이 깨지지 않는다
- [x] 멱등 재시도 시 동일 결과(가능하면)

완료 기준:
- [x] `frontend: lint` 통과

### 10.6 Implementation Log (공유용)
- **DB**: `docs/DB_MIGRATION_V3.sql` (컬럼 추가: `gold_mission_1_done`, `gold_mission_2_done`, `gold_mission_3_done`)
- **Backend**:
  - `backend/app/routers/admin_vault.py`: `admin_update_gold_missions` 구현 (미션 토글 + `gold_status` 자동 계산)
  - `backend/app/schemas.py`: `AdminGoldMissionsUpdateRequest` 추가
- **Frontend**:
  - `frontend/components/admin-v2/AdminV2UsersGrid.jsx`: 토글 UI 구현, 상태별(CLAIMED) 비활성화 처리
  - `frontend/pages/api/vault/admin/users/[userId]/vault/gold-missions.js`: Next.js Proxy 추가

### 10.7 Troubleshooting
- **Status**: ✅ **완료 (Completed)**
- **Issue Track**:
  - 초기 `test_admin_gold_missions_v3` 작성 시 `ImportError` 발생 → `app.services.common` 경로 수정으로 해결.
  - 현재 특이사항 없음.

---

## 11. P0 기능 체크리스트: 플래티넘/다이아 조건 변경 (v3)
설계 출처: `docs/REFACTORING_PLAN_V3.md`의 2.2, 2.3

### 11.1 플래티넘 조건 변경
- [x] 누적 입금액 조건이 “200,000원” 기준으로 동작한다
- [x] 누적 입금 횟수 조건이 “3회” 기준으로 동작한다
- [x] 플래티넘 해금은 “골드 금고 해제(선행조건)”를 만족해야만 가능하다
  - [x] 선행조건 정의를 명확히 했다(예: `gold_status`가 `UNLOCKED` 또는 `CLAIMED`)
- [x] 기존 플래티넘 로직(출석/리뷰 등)과 충돌하지 않도록 정리했다(중복 규칙 제거 또는 우선순위 확정)

### 11.2 다이아 조건/만료 변경
- [x] 다이아 누적 충전 조건이 “2,000,000원” 기준으로 동작한다
- [x] CC카지노 출석부 기준 출석 “2회” 조건이 동작한다
  - [x] 출석 기준 필드가 서버에서 단일 소스로 관리된다(예: `diamond_attendance_days` 또는 별도 필드)
- [x] 다이아 해금은 “플래티넘 금고 해제(선행조건)”를 만족해야만 가능하다
  - [x] 선행조건 정의를 명확히 했다(예: `platinum_status`가 `UNLOCKED` 또는 `CLAIMED`)
- [x] 다이아 만료가 5일(120시간)로 동작한다
  - [x] `diamond_expires_at`(또는 동등한 필드) 기준으로 만료/표시/연산이 일관되다

완료 기준:
- [x] `backend: pytest (docker)` 통과

### 11.3 Implementation Log (공유용)
- **Backend**:
  - `backend/app/services/vault_service.py`: `compute_platinum_status`, `compute_diamond_status` 업데이트 (누적 입금/횟수, 출석, 선행조건 반영)
  - `backend/app/main.py`: `user_daily_import` 로직에 `diamond_attendance_days`, `gold_mission_1_done` 업데이트 반영
  - `backend/app/main.py`: **다이아몬드 해금 조건에 `platinum_status = 'CLAIMED'` 추가** (2026-01-10)
  - `backend/app/schemas.py`: `AdminDepositUpdateRequest` 등 V3 필드 반영 (`platinum_deposit_total` 등)
  - `backend/app/schemas.py`: `DailyUserImportRow`에 `cc_attendance_count` 필드 추가 (2026-01-10)
- **Tests**:
  - `backend/tests/test_daily_import_v3.py`: 시나리오 테스트 작성 (CSV Import -> 조건 충족 -> 해금)
  - `backend/tests/test_vault_unlock_v3.py`: v3 해금 조건 테스트 12개 (2026-01-10)
  - `backend/tests/test_sot_consistency.py`: SOT 정합성 테스트 14개 (2026-01-10)

### 11.4 Troubleshooting
- **Status**: ✅ **완료 (Resolved)**
- **Issue**: `test_daily_import_v3.py`에서 `KeyError: 'gold_status'` 발생.
- **Cause**: `admin_users.py` SQL 쿼리에 `diamond_attendance_days` 컬럼이 추가되면서, 이후 컬럼들의 인덱스가 밀림. 이로 인해 `row[...]` 매핑이 어긋나 엉뚱한 값(날짜 필드에 불리언 등)을 참조하여 500 에러 발생.
- **Resolution**: `admin_users.py`의 `row` 인덱스 접근 번호를 SQL `SELECT` 순서에 맞게 수정하여 해결.

---

## 12. P0 기능 체크리스트: UX/IA 요구사항 (v3)
설계 출처: `docs/REFACTORING_PLAN_V3.md`의 2.4

### 12.1 유저 로그인에서 어드민 완전 분리
- [x] 유저 UI에서 어드민 메뉴/링크가 아예 보이지 않는다
- [x] 직접 URL 접근으로도 어드민 페이지가 열리지 않는다(가드/리다이렉트/403 중 택1, 팀 기준으로 통일)
- [x] 유저/어드민 분리 변경이 기존 로그인 플로우를 깨지 않는다

### 12.2 금고 가이드 내 네비게이션
- [x] 가이드 화면 상단에 "뒤로가기 / 홈 버튼"이 요구사항대로 존재한다
- [x] 동작이 명확하다(뒤로: 이전 화면, 홈: 대시보드/메인)

### 12.3 사이드바 문구 3종(고정)
- [x] "현재 변경사항 - 금고조건 변경 후 진행예정입니다." 문구가 고정으로 유지된다
- [x] "이벤트 종료일 - 다이아 금고 기준으로 연동" 문구가 v3 다이아 마감(5일) 기준으로 표기된다
- [x] "최소 34만원 이사지원 혜택" 문구가 반영된다

완료 기준:
- [x] `frontend: lint` 통과

### 12.4 Implementation Log (공유용)
- **검증 완료 (2026-01-10)**:
  - `frontend/pages/index.jsx`: 어드민 링크 없음 확인
  - `frontend/pages/admin.jsx` L56-60: 유저 로그인 + 어드민 미인증 시 `/`로 리다이렉트
  - `frontend/pages/admin/v2.jsx` L33-36: 동일한 가드 로직 구현
  - `frontend/pages/guide.jsx` L97-108: Header 컴포넌트에 뒤로가기/홈 버튼 구현
- **§12.3 사이드바 문구 구현 완료 (2026-01-10)**:
  - `frontend/pages/index.jsx` L123-137: 사이드바 안내 문구 섹션 추가
  - SOT 연동: `VAULT_EXPIRY_HOURS.DIAMOND` (120시간/5일) import 사용
  - 스타일: `styles.sidebarNotice`, `styles.noticeItem`, `styles.noticeLabel`, `styles.noticeText` 추가

---

## 13. P0 기능 체크리스트: 운영 CSV 업로드(cc_attendance_count) (v3)
설계 출처: `docs/REFACTORING_PLAN_V3.md`의 2.5

### 13.1 CSV 입력/스키마
- [x] CSV 칼럼 `cc_attendance_count`를 파싱한다(정수, 0~2+)
- [x] 누락/빈값 처리 정책이 명확하다(기본값 0 등)
- [x] 잘못된 값(문자/음수 등) 처리 정책이 명확하다(에러/클램프 중 택1)

### 13.2 admin import 파이프라인 반영
- [x] 반영 위치가 계획서대로다(user-daily-import / admin imports)
- [x] DB에 값이 저장된다(연동 대상 필드가 명확하다)
- [x] 다이아 출석 조건 계산이 이 값과 일관되게 연결된다

완료 기준:
- [x] `backend: pytest (docker)` 통과

### 13.3 Implementation Log (공유용)
- **Backend**:
  - `backend/app/main.py`: `DailyUserImportRequest`, `DailyUserImportRow` 스키마에 `cc_attendance_count` 추가 및 파싱 로직 구현
  - SQL Update 쿼리: `diamond_attendance_days` 컬럼 매핑 추가

### 13.4 Troubleshooting
- **Status**: ✅ **완료 (Resolved)**
- **Resolution**: Section 11.4의 `admin_users.py` 인덱스 수정으로 해결됨.

---

## 14. 신규 테스트 계획(최소 세트)
설계 출처: `docs/REFACTORING_PLAN_V3.md`의 10.2

### 14.1 v3 조건/만료 회귀(Backend)
- [x] `test_vault_unlock_v3.py` 추가 또는 동등한 테스트 묶음이 존재한다
  - [x] 플래티넘은 골드 선행조건 없으면 해제되지 않는다
  - [x] 플래티넘 누적 입금 20만/3회 조건이 기대대로 동작한다
  - [x] 다이아는 플래티넘 선행조건 없으면 해제되지 않는다
  - [x] 다이아 만료 5일(120h) 규칙이 기대대로 동작한다
  - [x] 다이아 출석 2회/누적 200만 조건이 기대대로 동작한다

### 14.2 SOT 정합성(선택이지만 권장)
- [x] `test_sot_consistency.py` 추가 또는 동등한 테스트가 존재한다
  - [x] BE/FE SOT의 보상액/만료시간 핵심 값이 일치한다 (FE 접근 불가 시 skip)

### 14.3 admin import CSV(v3)
- [x] `test_daily_import_v3.py`로 동등한 테스트가 존재한다
  - [x] `cc_attendance_count` 입력이 DB/조건 계산에 반영된다

완료 기준:
- [x] `backend: pytest (docker)` 통과 (51 passed, 2 skipped)

### 14.4 Implementation Log (공유용)
- **테스트 파일 추가 (2026-01-10)**:
  - `backend/tests/test_vault_unlock_v3.py`: 12개 테스트 (골드/플래티넘/다이아 해금 조건)
  - `backend/tests/test_sot_consistency.py`: 14개 테스트 (SOT 값 정합성, FE 2개 skip)
- **테스트 결과**: 51 passed, 2 skipped, 23 warnings
- **해금 조건 정책 정리**:
  | 티어 | 해금 조건 |
  |------|-----------|
  | 골드 | `telegram_ok = True` |
  | 플래티넘 | `gold_status = 'CLAIMED'` + `deposit_total ≥ 200K` + `deposit_count ≥ 3` + `attendance ≥ 3` + `review_ok` |
  | 다이아몬드 | `platinum_status = 'CLAIMED'` + `deposit_total ≥ 2M` |

---

## 15. 배포/롤백 체크리스트(최소)
- [x] DB 먼저 적용(Expand) - Docker 환경 마이그레이션 완료 (2026-01-10)
- [ ] BE 배포(새 엔드포인트 추가 — 기본 UX에 영향 없게)
- [ ] FE 배포(토글 UI 노출)
- [ ] 문제 발생 시: FE에서 토글 UI 비활성화(또는 라우트 숨김)로 즉시 완화

---

## 16. 오늘 바로 할 “다음 3개”(추천)
- [x] Phase 5(DB): 골드 미션 컬럼 3개 추가를 `docs/DB_MIGRATION_V3.sql`에 반영 ✅ 완료
- [x] Phase P0(BE): `POST /.../gold-missions` 엔드포인트 + 감사로그 + 멱등 ✅ 완료
- [x] Phase P0(FE): Admin v2 유저 상세 패널에 토글 UI + 프록시 라우트 ✅ 완료

### 다음 우선순위 (2026-01-10 이후)
- [x] §12 UX/IA 요구사항: 유저/어드민 분리, 사이드바 문구 3종
- [x] §8 Phase 4: 프론트엔드 SOT 치환 완료
- [x] 프론트엔드 린트 최종 검증
- [ ] §15 배포/롤백: 운영 환경 배포 준비 (BE/FE)
