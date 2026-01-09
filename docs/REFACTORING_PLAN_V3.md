# 금고 시스템 v3.0 리팩토링 계획서

## 1. 메타
- 문서 타입: 리팩토링 계획서
- 버전: v3.0.1
- 작성일: 2026-01-09
- 최종 수정: 2026-01-09
- 전략: **(A) 구조 리팩토링 + 기능 변경 동시 진행** / **(B) 속도 우선 Fast Track**
- 테스트: **23개 기존 테스트 유지 + 신규 테스트 추가**
- 목적: 금고 조건/보상 변경 + 아키텍처 개선 (SOLID 준수)

---

## 1.1 속도 우선 실행(Fast Track)
목표: 일정이 가장 빠르게 진행되도록 **최소 변경 경로**로 P0 기능을 먼저 완료

원칙:
- **라우터 분리(Phase 2)와 서비스 레이어(Phase 3)는 후순위**로 미룬다
- BE 변경은 기존 구조(`backend/app/main.py`)에서 직접 반영 가능
- DB 마이그레이션 + BE 변경은 **한 번에 묶어 진행 가능** (FE는 별도 스프린트)
- 최소 테스트: `pytest` 신규 1개 + 스모크 시나리오 1개

---

## 0. 진행 상태 요약 ✅

| Phase | 작업 | 상태 | 산출물 |
|-------|------|------|--------|
| **0** | SOT 파일 생성 | ✅ 완료 | `vault_config.py`, `vaultConfig.js`, `VAULT_SOT.md` |
| **1** | 유틸리티 분리 | ✅ 완료 | `utils/*.py` |
| **2** | 라우터 분리 | ✅ 완료 | `routers/*.py` |
| **3** | 서비스 레이어 | ✅ 완료 | `services/*.py` |
| **4** | 프론트엔드 리팩토링 | ✅ 완료 | Sprint 1.5 + SOT 치환 완료 |
| **5** | DB 마이그레이션 | ✅ 완료 | 골드 미션 컬럼 3개 + v3 컬럼 추가 |

### 생성된 SOT 파일 목록
- ✅ `backend/app/constants/vault_config.py` (218줄)
- ✅ `frontend/lib/vaultConfig.js` (346줄)
- ✅ `docs/VAULT_SOT.md` (224줄)
- ✅ `docs/DB_MIGRATION_V3.sql` (158줄)

---

## 2. 변경 요구사항 요약

### 2.1 골드 금고 (Gold Vault)
| 항목 | 기존 | 변경 |
|------|------|------|
| 보상액 | 10,000원 | 10,000원 (유지) |
| 조건1 | 텔레그램 채널 입장 | CC카지노 공식채널 입장 |
| 조건2 | (없음) | 담당실장 공식채널 입장 |
| 조건3 | (없음) | 간편 본인확인 |
| 마감기한 | 가입 후 72시간 | 가입 후 72시간 (유지) |

**멘트 변경:**
```
CC카지노 공식채널 입장
- 각종 이벤트 및 보너스 드랍 진행

담당실장 공식채널 입장
- 본사혜택 외 추가 이벤트 진행

간편 본인 확인
- 담당실장에게 본인 확인
```

### 2.2 플래티넘 금고 (Platinum Vault)
| 항목 | 기존 | 변경 |
|------|------|------|
| 보상액 | 30,000원 | **30,000원** (유지) |
| 조건1 | (v2 기준) 단일 50,000원 입금 | **누적 입금 20만원** |
| 조건2 | (v2 기준) 3일 연속 출석 | **누적 입금 3회** |
| 조건3 | (v2 기준) 리뷰 작성 | **골드 금고 해제** (선행조건) |
| 마감기한 | 가입 후 72시간 | 가입 후 72시간 (유지) |

**멘트 변경:**
```
누적 입금 20만원 달성
- 신규 입플도 놓치지 마세요!

누적 입금 3회 달성
- 최소 이용 금액 단돈 만원 이상!
```

### 2.3 다이아 금고 (Diamond Vault)
| 항목 | 기존 | 변경 |
|------|------|------|
| 보상액 | 70,000원 | **300,000원** |
| 조건1 | (v2 기준) 누적 충전 500,000원 | **누적 충전 200만원** |
| 조건2 | (없음) | **CC카지노 출석부 기준 2회 출석** |
| 조건3 | (없음) | **플래티넘 금고 해제** (선행조건) |
| 마감기한 | 가입 후 72시간 | **가입 후 5일 (120시간)** |
| 색상 테마 | 기존 | **변경 예정** |

### 2.4 UX/IA 추가 요구사항 (v3)
| 항목 | 요구사항 | 비고 |
|------|----------|------|
| 금고 가이드 | **뒤로가기 버튼 / 홈 버튼 추가** | 가이드 화면 상단 네비게이션 영역 |
| 로그인/권한 | **유저 로그인 시 관리자 페이지가 아예 안 보이게** | 라우팅/네비/직접 URL 접근 모두 차단 필요 |
| 관리자 페이지 | **관리자 페이지 별도 구성(유저와 철저히 분리 운영)** | URL/레이아웃/접근제어 분리 |
| 사이드바 메뉴 멘트 | "현재 변경사항 - 금고조건 변경 후 진행예정입니다." | 고정 문구로 유지(현 단계 안내) |
| 사이드바 멘트(추가) | "이벤트 종료일 - 다이아 금고 기준으로 연동" | v3 다이아 마감(5일) 기준으로 표기 |
| 사이드바 멘트(추가) | "최소 34만원 이사지원 혜택" | 문구만 반영 |
| 지갑/인벤토리 | **없음(현재는 제외)** | 스코프 아웃(추가 구현 금지)

### 2.5 운영 업로드(CSV) 변경
- CC카지노 출석부 기준을 반영하기 위해 **어드민 CSV 업로드에 칼럼 추가**
  - 제안 칼럼명: `cc_attendance_count` (정수, 누적 0~2+)
  - 반영 위치: admin import 파이프라인(user-daily-import / admin imports)

### 2.6 어드민 UX 개선: 골드 미션 O/X 관리
**목표**: 관리자 화면에서 DB raw 값을 그대로 보여주는 대신, 골드 금고 진행을 **O/X 토글**로 빠르게 처리

#### 2.6.1 현재 어드민 구현(베이스라인)
- FE(Admin v2)
  - 유저 리스트/상세: `components/admin-v2/AdminV2UsersGrid.jsx`
    - 현재는 `telegram_ok`, `review_ok`, `joined_date`, `deposit_total` 등 **user_admin_snapshot 계열 필드 편집** 중심
    - 금고 관련은 **만료 연장**, **입금(플래티넘/다이아) 보정** 액션만 존재
    - 골드 미션 단위의 편집 UI는 없음
  - 운영 일괄 변경(벌크): `components/admin-v2/AdminV2OperationsPanel.jsx`
    - Gold/Platinum/Diamond 상태를 `LOCKED/UNLOCKED/CLAIMED/EXPIRED` 드롭다운으로 입력(= DB 상태값을 그대로 조작)
- BE
  - 단일 유저 상태 변경: `POST /api/vault/admin/users/{user_id}/vault/status`
    - 요청: `AdminStatusUpdateRequest` (`gold_status`, `platinum_status`, `diamond_status`)
    - 규칙: `CLAIMED` 상태는 되돌릴 수 없음(`CANNOT_MODIFY_CLAIMED`)
    - 멱등키/감사로그 적용(액션: `ADMIN_STATUS_UPDATE`)

#### 2.6.2 개선 방향(권장 UX 정의)
- 관리자 입력은 “골드 상태”가 아니라 **골드 미션 3개(O/X)**를 기본으로 한다.
- `gold_status`는 **미션 3개가 모두 O일 때만**(그리고 `CLAIMED/EXPIRED`가 아닐 때만) 자동으로 `UNLOCKED`가 되도록 계산한다.
- 운영상 예외가 필요할 수 있으므로 “상태 강제”는 **별도 고급 기능(권한/확인 필요)** 로 분리한다.
  - 기본 화면에는 노출하지 않거나, “고급(권장X)”로 분리해 실수 위험을 낮춘다.

관리 항목(기본 화면):
- 골드 미션1: O / X
- 골드 미션2: O / X
- 골드 미션3: O / X
- 골드 상태: O / X (표시 전용: 결과)

#### 2.6.3 데이터 모델(권장)
저장 위치는 `vault_status`가 가장 일관적(금고 상태/만료와 강하게 결합).

- `vault_status`에 컬럼 추가
  - `gold_mission_1_done` BOOLEAN NOT NULL DEFAULT FALSE
  - `gold_mission_2_done` BOOLEAN NOT NULL DEFAULT FALSE
  - `gold_mission_3_done` BOOLEAN NOT NULL DEFAULT FALSE
  - (선택) `gold_missions_updated_at` TIMESTAMPTZ

상태 계산(서버 기준, 자동 반영):
- 현재 `gold_status`가 `CLAIMED` 또는 `EXPIRED`이면 **미션 변경이 있더라도 gold_status는 변경하지 않음**
- 그 외에는
  - (m1 && m2 && m3) == true → `gold_status = UNLOCKED`
  - else → `gold_status = LOCKED`

주의:
- 현재 시스템은 상태값을 직접 수정할 수 있으므로, “미션 기반 자동 계산”을 도입하면 골드에 대해서는 **상태 직접 수정 루트를 제한**하는 것이 안전하다.
  - 단, 긴급 운영을 위해 “상태 강제” 엔드포인트/토글은 별도로 남길 수 있다(권한/확인/감사로그 강화).

#### 2.6.4 API 설계(권장)
기존 `.../vault/status`는 “상태 직접 변경” 성격이라, 미션 토글은 별도 엔드포인트로 분리하는 편이 명확하다.

1) 골드 미션 토글(권장, 기본 기능)
- `POST /api/vault/admin/users/{user_id}/vault/gold-missions`
- Headers
  - `x-admin-password`: 필수
  - `x-idempotency-key`: 필수(현 어드민 패턴과 동일)
- Request Body(부분 업데이트 허용)
  - `gold_mission_1_done?: bool`
  - `gold_mission_2_done?: bool`
  - `gold_mission_3_done?: bool`
- Response
  - `updated: bool`
  - `gold_mission_1_done: bool`
  - `gold_mission_2_done: bool`
  - `gold_mission_3_done: bool`
  - `gold_status: str` (DB에 저장된 최종 상태)
  - `expires_at?: str`

서버 처리 규칙(권장):
- 입력이 하나도 없으면 `NO_FIELDS` (400)
- `USER_NOT_FOUND` (404)
- `CLAIMED/EXPIRED`인 경우
  - (권장) 미션 업데이트는 허용하되, `gold_status` 자동 변경은 하지 않음
  - 또는 더 보수적으로는 `409 CANNOT_MODIFY_CLAIMED`처럼 차단(운영 경험에 따라 선택)
- 감사로그 액션: `ADMIN_GOLD_MISSIONS_UPDATE`
  - `request_body`: 변경된 필드와 값만 기록
  - `response_summary`: 계산된 gold_status 포함

2) 상태 강제(선택, 고급 기능)
- 원칙적으로 기존 `POST /api/vault/admin/users/{user_id}/vault/status`를 사용하되,
  - FE에서는 별도 “상태 강제” 토글/드롭다운을 분리하고, 확인 텍스트(예: APPLY) + 사유 입력을 요구
  - 감사로그에는 action을 `ADMIN_GOLD_STATUS_FORCE`처럼 별도 분리하는 것이 이상적(오조작 추적)

#### 2.6.5 FE(Admin v2) UI/플로우 설계(권장)
적용 위치: 유저 단일 편집(상세 패널)
- `components/admin-v2/AdminV2UsersGrid.jsx`
  - 상세 패널에 “골드 미션(O/X)” 섹션 추가
    - 체크박스 3개(미션1/2/3)
    - “골드 상태”는 읽기 전용으로 표시(현재 `selectedRow.gold_status`)
  - 토글 변경 시 저장 방식
    - (권장) 토글 즉시 API 호출(멱등키 포함) → 성공 시 `selectedRow`/리스트 row를 서버 응답 기준으로 갱신
    - 실패 시 토글 롤백 + 토스트 표시

프록시 라우트(Next API)
- `pages/api/vault/admin/users/[userId]/vault/gold-missions.js` 신설(백엔드 업스트림 패턴과 동일)

#### 2.6.6 테스트(우선순위 P0)
- BE: `test_admin_gold_missions_v3.py::test_gold_missions_toggle_updates_status`
  - (m1,m2,m3) 조합 변경 → gold_status가 LOCKED↔UNLOCKED로 기대대로 계산되는지
  - CLAIMED 상태 보호 규칙(되돌림 금지)과 충돌하지 않는지
  - 멱등키 재시도 시 동일 응답(replayed) 동작 확인(가능하면)

---

## 3. 현재 아키텍처 문제점

### 3.1 SOLID 원칙 위반 현황

| 원칙 | 위반 내용 | 심각도 |
|------|----------|--------|
| **SRP** | `main.py` 4,208줄에 35개 엔드포인트 + 모든 비즈니스 로직 | 🔴 Critical |
| **OCP** | 금고 조건 변경 시 `main.py` 직접 수정 필요 | 🔴 Critical |
| **DIP** | 상수/로직 하드코딩, 추상화 없음 | 🟡 High |
| **ISP** | N/A (현재 인터페이스 미정의) | ⚪ N/A |
| **LSP** | N/A (상속 미사용) | ⚪ N/A |

### 3.2 현재 파일 크기

| 파일 | 크기 | 라인 수 | 책임 수 |
|------|------|---------|---------|
| `backend/app/main.py` | 164KB | 4,208 | 35+ |
| `frontend/pages/index.jsx` | 50KB | 1,172 | 10+ |
| `frontend/pages/admin.jsx` | 72KB | 2,000+ | 15+ |

---

## 4. 리팩토링 전략

### 4.1 Phase 0: SOT (Source of Truth) 파일 생성 ⭐ 최우선
**목적**: 모든 금고 관련 상수를 단일 파일로 중앙 집중화

```
backend/app/constants/vault_config.py  ← SOT (Backend)
frontend/lib/vaultConfig.js            ← SOT (Frontend)
docs/VAULT_SOT.md                      ← 문서화 (Human-readable)
```

**효과**:
- 금고 조건/보상 변경 시 **1개 파일만 수정**
- OCP 준수: 설정 변경이 코드 변경 없이 가능
- 테스트/검증 용이

### 4.2 Phase 1: 유틸리티 분리 (난이도: ⭐)
```
backend/app/utils/
├── __init__.py
├── parsers.py          # _parse_int_optional, _parse_date_optional
├── auth.py             # verify_admin_password
├── audit.py            # _log_admin_action
└── sql_builders.py     # _build_user_target_sql
```

**예상 라인 감소**: ~200줄

### 4.3 Phase 2: 라우터 분리 (난이도: ⭐⭐)
```
backend/app/routers/
├── __init__.py
├── health.py           # /health
├── vault.py            # /api/vault/status, claim, attendance
├── admin_imports.py    # /api/vault/admin/imports, user-daily-import
├── admin_jobs.py       # /api/vault/admin/jobs/*
├── admin_users.py      # /api/vault/admin/users/*
├── admin_notifications.py
├── admin_segments.py
├── admin_operations.py # extend-expiry, bulk-update
└── admin_audit.py      # audit-log
```

**예상 라인 감소**: ~3,000줄 (main.py → 각 라우터)

### 4.4 Phase 3: 서비스 레이어 (난이도: ⭐⭐⭐)
```
backend/app/services/
├── __init__.py
├── vault_service.py       # 금고 상태 조회/변경 로직
├── import_service.py      # CSV 업로드 처리
├── job_service.py         # 비동기 Job 관리
├── notification_service.py
└── audit_service.py
```

### 4.5 Phase 4: 리포지토리 레이어 (난이도: ⭐⭐⭐)
```
backend/app/repositories/
├── __init__.py
├── vault_repository.py
├── user_repository.py
├── job_repository.py
└── notification_repository.py
```

---

## 5. 작업 순서 (우선순위)

### Sprint 1: SOT + 비즈니스 로직 변경 (1-2일)
| # | 작업 | 파일 | 상태 | 우선순위 |
|---|------|------|------|----------|
| 1 | SOT 파일 생성 (Backend) | `constants/vault_config.py` | 🟢 | 🔴 P0 |
| 2 | SOT 파일 생성 (Frontend) | `lib/vaultConfig.js` | 🟢 | 🔴 P0 |
| 3 | SOT 문서화 | `docs/VAULT_SOT.md` | 🟢 | 🟡 P1 |
| 4 | Backend 상수 참조 변경 | `main.py`, `routers/*.py`, `services/*.py` | 🟢 | 🔴 P0 |
| 5 | Frontend 상수 참조 변경 | `index.jsx` 등 vault 관련 | ⏳ | 🔴 P0 |
| 6 | 테스트 실행 및 검증 | - | 🟢 | 🔴 P0 |

### Sprint 1.5: 권한/라우팅 분리(유저 vs 어드민) (0.5-1일)
| # | 작업 | 범위 | 상태 | 우선순위 |
|---|------|------|------|----------|
| 1 | 유저 로그인 시 어드민 UI/메뉴 숨김 | FE | 🟢 | 🔴 P0 |
| 2 | 어드민 경로 직접 접근 차단(가드) | FE/BE | 🟢 | 🔴 P0 |
| 3 | 관리자 페이지를 별도 구성(레이아웃 분리) | FE | 🟢 | 🟡 P1 |

### Sprint 1.6: 어드민 골드 미션 O/X (0.5-1일)
| # | 작업 | 범위 | 상태 | 우선순위 |
|---|------|------|------|----------|
| 1 | 골드 미션 3개 저장 필드 확정(SOT 포함) | BE/Docs | 🟢 | 🔴 P0 |
| 2 | 어드민에서 미션 O/X 토글 UI 제공 | FE(Admin v2) | 🟢 | 🔴 P0 |
| 3 | 미션 변경 API 추가/수정(멱등/감사로그 포함) | BE | 🟢 | 🔴 P0 |
| 4 | 골드 상태 계산/표시(자동) | FE/BE | 🟢 | 🟡 P1 |

### Sprint 2: 유틸리티 분리 (0.5일) — ✅ 완료
| # | 작업 | 대상 함수 | 상태 |
|---|------|----------|------|
| 1 | `utils/parsers.py` 생성 | `_parse_int_optional`, `_parse_date_optional` | 🟢 |
| 2 | `utils/auth.py` 생성 | `verify_admin_password` | 🟢 |
| 3 | `utils/audit.py` 생성 | `_log_admin_action` | 🟢 |
| 4 | `utils/sql_builders.py` 생성 | `_build_user_target_sql`, `_apply_job_timeouts` | 🟢 |
| 5 | main.py import 수정 | - | 🟢 |
| 6 | 테스트 실행 | - | 🟢 |

### Sprint 3: 라우터 분리 (2-3일) — ✅ 완료 (일부 라우터만 분리)
| # | 작업 | 라인 수 (예상) | 상태 |
|---|------|---------------|------|
| 1 | `routers/health.py` | ~10줄 | 🟢 |
| 2 | `routers/vault.py` | ~300줄 | 🟢 |
| 3 | `routers/admin_imports.py` | ~600줄 | ⏳ |
| 4 | `routers/admin_jobs.py` | ~400줄 | ⏳ |
| 5 | `routers/admin_users.py` | ~500줄 | 🟢 |
| 6 | `routers/admin_notifications.py` | ~200줄 | ⏳ |
| 7 | `routers/admin_segments.py` | ~150줄 | ⏳ |
| 8 | `routers/admin_operations.py` | ~600줄 | ⏳ |
| 9 | `routers/admin_audit.py` | ~100줄 | ⏳ |
| 10 | main.py 라우터 등록 | ~50줄 | 🟢 |

### Sprint 4: 서비스/리포지토리 (3-5일) - 선택적
- 현재 직접 DB 접근 패턴 유지하되, 핵심 비즈니스 로직만 서비스로 분리
- 추후 도메인 확장 시 리포지토리 레이어 추가

---

## 6. 검증 계획

### 6.1 테스트 체크포인트
각 Phase 완료 후:
```bash
# Backend 테스트
docker compose exec -T api pytest -vv -ra --maxfail=1

# Frontend 린트
cd frontend && npm run lint
```

### 6.2 회귀 테스트 범위
- [ ] 골드 금고 해금 플로우
- [ ] 플래티넘 금고 해금 플로우 (새 조건 반영)
- [ ] 다이아 금고 해금 플로우 (새 조건/보상 반영)
- [ ] 어드민 CSV 업로드
- [ ] 어드민 사용자 관리
- [ ] 만료 시간 정확성 (다이아: 5일)

---

## 7. 롤백 계획

### 7.1 Git 브랜치 전략
```
main ← 현재 안정 버전
  └── feature/vault-v3-refactor ← 리팩토링 브랜치
        ├── phase-0-sot
        ├── phase-1-utils
        ├── phase-2-routers
        └── phase-3-services
```

### 7.2 롤백 시나리오
- Phase별 독립 커밋으로 부분 롤백 가능
- SOT 파일 도입 실패 시: 기존 하드코딩으로 즉시 복구

---

## 8. 예상 결과

### 8.1 파일 구조 (After)
```
backend/app/
├── main.py              # ~100줄 (앱 초기화 + 라우터 등록)
├── config.py            # 환경설정
├── db.py                # DB 연결
├── schemas.py           # Pydantic 모델
├── constants/
│   └── vault_config.py  # 🆕 SOT
├── utils/
│   ├── parsers.py
│   ├── auth.py
│   ├── audit.py
│   └── sql_builders.py
├── routers/
│   ├── health.py
│   ├── vault.py
│   ├── admin_imports.py
│   ├── admin_jobs.py
│   ├── admin_users.py
│   ├── admin_notifications.py
│   ├── admin_segments.py
│   ├── admin_operations.py
│   └── admin_audit.py
└── services/            # Phase 3+
    └── vault_service.py
```

### 8.2 SOLID 준수 현황 (After)

| 원칙 | 개선 내용 | 상태 |
|------|----------|------|
| **SRP** | 각 라우터가 단일 도메인 담당 | ✅ |
| **OCP** | SOT 파일로 설정 변경 시 코드 수정 최소화 | ✅ |
| **DIP** | 설정을 constants 모듈에서 주입 | ✅ |

---

## 9. UI 와이어프레임 (v3.0)

### 9.1 금고 카드 레이아웃 (사진 참조 기반)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                             금고 대시보드                                    │
├─────────────────┬─────────────────┬─────────────────────────────────────────┤
│     골  드      │    플래티넘     │              다이아                     │
├─────────────────┼─────────────────┼─────────────────────────────────────────┤
│   [ 진행률 ]    │  [ 소멸타임 ]   │           [ 소멸타임 ]                  │
│       x         │  [ 진행률   ]   │           [ 진행률   ]                  │
│   [ 미  션 ]    │  [ 미  션   ]   │           [ 미  션   ]                  │
└─────────────────┴─────────────────┴─────────────────────────────────────────┘
```

### 9.2 각 금고별 표시 요소

| 금고 | 소멸타임 | 진행률 | 미션 | 비고 |
|------|:--------:|:------:|:----:|------|
| 골드 | ❌ | ✅ | ✅ | 진행률 + 미션만 표시 |
| 플래티넘 | ✅ | ✅ | ✅ | 전체 표시 |
| 다이아 | ✅ | ✅ | ✅ | 전체 표시 + 색상 변경 |

### 9.4 금고 화면 구조(요구사항 고정)
```
골드         플래티넘        다이아
진행률       소멸타임        소멸타임
x            진행률          진행률
미션         미션            미션
수령신청     수령신청        수령신청
```

### 9.5 기타 UI 요소
- 금고 가이드: 뒤로가기/홈 버튼 추가
- 로그인: 유저/어드민 철저 분리(유저에서 어드민 노출 금지)
- 지갑/인벤토리: 없음(추가 UI/메뉴/페이지 만들지 않음)

### 9.3 미션 목록 UI

#### 골드 금고
```
┌─────────────────────────────────────────┐
│ ☐ CC카지노 공식채널 입장                │
│   └─ 각종 이벤트 및 보너스 드랍 진행    │
├─────────────────────────────────────────┤
│ ☐ 담당실장 공식채널 입장                │
│   └─ 본사혜택 외 추가 이벤트 진행       │
├─────────────────────────────────────────┤
│ ☐ 간편 본인 확인                        │
│   └─ 담당실장에게 본인 확인             │
└─────────────────────────────────────────┘
```

#### 플래티넘 금고
```
┌─────────────────────────────────────────┐
│ ☐ 누적 입금 20만원 달성                 │
│   └─ 신규 입플도 놓치지 마세요!         │
│   └─ 현재: 0원 / 200,000원              │
├─────────────────────────────────────────┤
│ ☐ 누적 입금 3회 달성                    │
│   └─ 최소 이용 금액 단돈 만원 이상!     │
│   └─ 현재: 0회 / 3회                    │
├─────────────────────────────────────────┤
│ ☐ 골드 금고 해금 (선행 조건)            │
└─────────────────────────────────────────┘
```

#### 다이아 금고
```
┌─────────────────────────────────────────┐
│ ☐ 누적 충전 200만원 달성                │
│   └─ 현재: 0원 / 2,000,000원            │
├─────────────────────────────────────────┤
│ ☐ CC카지노 2회 출석                     │
│   └─ CC카지노 출석부 체크 기준          │
│   └─ 현재: 0회 / 2회                    │
├─────────────────────────────────────────┤
│ ☐ 플래티넘 금고 해금 (선행 조건)        │
└─────────────────────────────────────────┘
```

---

## 10. 신규 테스트 계획

### 10.1 기존 테스트 (23개 유지)

| 파일 | 테스트 수 | 상태 |
|------|----------|------|
| `test_health.py` | 1 | ✅ 유지 |
| `test_status_claim.py` | 4 | ✅ 유지 |
| `test_referral.py` | 2 | ✅ 유지 |
| `test_notify.py` | 2 | ✅ 유지 |
| `test_compensation.py` | 2 | ✅ 유지 |
| `test_admin_users.py` | 4 | ✅ 유지 |
| `test_admin_jobs.py` | 3 | ✅ 유지 |
| `test_admin_idempotency.py` | 2 | ✅ 유지 |
| `test_daily_import.py` | 2 | ✅ 유지 |
| `test_e2e_admin_flows.py` | 1 | ✅ 유지 |

### 10.2 신규 테스트 추가 예정

| 테스트 파일 | 테스트명 | 설명 | 우선순위 |
|-------------|----------|------|----------|
| `test_vault_unlock_v3.py` | `test_platinum_requires_gold` | 플래티넘 해금 시 골드 필수 검증 | P0 |
| | `test_platinum_deposit_total` | 누적입금 20만원 조건 | P0 |
| | `test_platinum_deposit_count` | 입금 3회 조건 | P0 |
| | `test_diamond_requires_platinum` | 다이아 해금 시 플래티넘 필수 | P0 |
| | `test_diamond_expiry_5days` | 다이아 5일 기한 검증 | P0 |
| | `test_diamond_attendance_2days` | 출석 2회 조건 | P0 |
| | `test_diamond_deposit_2m` | 누적충전 200만원 조건 | P0 |
| `test_sot_consistency.py` | `test_rewards_match` | BE/FE SOT 보상액 일치 | P1 |
| | `test_expiry_match` | BE/FE SOT 기한 일치 | P1 |
| `test_admin_import_v3.py` | `test_import_cc_attendance_count` | CSV 칼럼 추가 및 DB 반영 검증 | P0 |
| `test_frontend_admin_visibility.spec` | `user_cannot_see_admin` | 유저 로그인에서 어드민 UI 미노출 | P0 |
| `test_admin_gold_missions_v3.py` | `test_gold_missions_toggle_updates_status` | 미션 3개 O/X 변경 → gold 상태 계산/반영 검증 | P0 |

---

## 11. 다음 단계 (즉시 실행 가능)

### Phase 1: 유틸리티 분리 (예상 1시간)

| 순서 | 작업 | 파일 |
|------|------|------|
| 1.1 | `utils/__init__.py` 생성 | |
| 1.2 | 파서 함수 분리 | `utils/parsers.py` |
| 1.3 | 인증 함수 분리 | `utils/auth.py` |
| 1.4 | 감사 로깅 분리 | `utils/audit.py` |
| 1.5 | SQL 빌더 분리 | `utils/sql_builders.py` |
| 1.6 | main.py import 수정 | |
| 1.7 | 테스트 실행 | 23개 통과 확인 |

### Phase 2: 라우터 분리 (예상 3시간)

| 순서 | 작업 | main.py 라인 | 대상 엔드포인트 |
|------|------|-------------|----------------|
| 2.1 | health.py | 259-262 | `/health` |
| 2.2 | vault.py | 264-600 | `/api/vault/status`, `claim`, `attendance` |
| 2.3 | admin_imports.py | 887-1500 | `/api/vault/user-daily-import`, `admin/imports` |
| 2.4 | admin_jobs.py | 2284-2644 | `/api/vault/admin/jobs/*` |
| 2.5 | admin_users.py | 2724-3870 | `/api/vault/admin/users/*` |
| 2.6 | admin_notifications.py | 1972-2284 | `/api/vault/notify`, `admin/notifications/*` |
| 2.7 | admin_segments.py | 2852-2956 | `/api/vault/admin/segments/*` |
| 2.8 | admin_operations.py | 1795-1972, 2956-3542 | `extend-expiry`, `bulk-update`, `targets/preview` |
| 2.9 | admin_audit.py | 2644-2724 | `/api/vault/admin/audit-log` |

---

## 12. 위험 관리

| 위험 | 확률 | 영향 | 대응 |
|------|------|------|------|
| 기존 테스트 실패 | 중 | 고 | 각 Phase 후 즉시 테스트 |
| API 경로 변경 | 저 | 고 | 라우터 prefix 동일하게 유지 |
| DB 마이그레이션 실패 | 저 | 고 | BEGIN/COMMIT + 백업 |
| 프론트/백엔드 불일치 | 중 | 중 | SOT 파일 동기화 검증 |

---

## Changelog
- 2026-01-09 v3.0.1: Fast Track 가이드 추가 (라우터 분리 후순위, BE 직접 반영 허용)
- 2026-01-09 v1.1: Phase 0 완료 상태 반영, 와이어프레임/테스트 계획 추가
- 2026-01-09 v1.0: 초기 작성

