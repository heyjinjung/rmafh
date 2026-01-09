# REFACTORING_CHECKLIST_V3

## 1. 메타
- 문서명: Vault v3 리팩토링 실행 체크리스트
- 문서 타입: 실행 가이드/체크리스트
- 문서 버전: v1.0.0
- 작성일: 2026-01-09
- 작성자: GitHub Copilot (GPT-5.2)
- 대상: Lead Architect/운영자/개발자
- 범위: `docs/REFACTORING_PLAN_V3.md`의 Phase 0~5 + v3 신규 기능(특히 골드 미션 O/X)

## Changelog
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

---

## 3. 공통 게이트(모든 Phase 공통)

### 3.1 작업 시작 전(필수)
- [ ] 현재 목표 Phase가 무엇인지 1줄로 적었다 (예: Phase 1 utils 분리)
- [ ] 변경 범위를 3개 파일/3개 엔드포인트 단위로 제한했다(가능하면)
- [ ] 기존 동작을 깨지 않는지 확인할 “스모크 시나리오”를 정했다(최소 1개)

### 3.2 완료 기준(필수)
- [ ] 백엔드 테스트 통과: VS Code Task `backend: pytest (docker)`
- [ ] 프론트 린트 통과: VS Code Task `frontend: lint`
- [ ] 새로 추가한 로직에는 최소 1개 테스트가 있다(핵심 로직만)

### 3.3 금지사항(리스크 방지)
- [ ] 스코프 아웃 항목(지갑/인벤토리)은 구현/노출하지 않았다
- [ ] 하드코딩으로 규칙을 흩뿌리지 않았다(설정은 SOT로)
- [ ] “상태를 직접 변경하는 UI/엔드포인트”를 기본 UX로 늘리지 않았다(실수 유발)

---

## 4. Phase 0: SOT 고정(이미 생성됨 — 유지보수 체크)
대상 파일:
- `backend/app/constants/vault_config.py`
- `frontend/lib/vaultConfig.js`
- `docs/VAULT_SOT.md`

체크리스트:
- [ ] v3 규칙 변경이 생기면 **SOT → 문서 → 코드** 순으로 반영한다
- [ ] SOT 값이 바뀌면 관련 테스트(조건/만료/보상)가 깨지지 않는지 확인했다
- [ ] “조건/보상/만료 시간” 관련 숫자가 다른 파일에 중복되어 있지 않다

완료 기준:
- [ ] `backend: pytest (docker)` 통과

---

## 5. Phase 1: 유틸리티 분리(난이도: 낮음)
목표: `backend/app/main.py`의 **순수 함수/검증/변환 로직**을 `utils/`로 분리

체크리스트:
- [ ] 분리 대상은 “DB 접근 없는 함수”부터 시작했다
- [ ] 함수 시그니처는 유지하거나, 최소 변경으로 래핑했다
- [ ] 분리 후에도 import 순환이 발생하지 않는다

완료 기준:
- [ ] `backend: pytest (docker)` 통과

---

## 6. Phase 2: 라우터 분리(난이도: 중)
목표: `backend/app/main.py` 엔드포인트를 도메인별 파일로 분리(기능 동일)

체크리스트:
- [ ] 엔드포인트 경로/메서드/응답은 변경하지 않았다(리팩토링만)
- [ ] 의존성 주입(예: admin password 검증)을 공통으로 유지했다
- [ ] 라우터 분리 후에도 OpenAPI/서버 부팅이 정상이다

완료 기준:
- [ ] `backend: pytest (docker)` 통과

---

## 7. Phase 3: 서비스 레이어(난이도: 중~상)
목표: “규칙/계산/가드레일”을 서비스 함수로 모아 SRP를 개선

체크리스트:
- [ ] 핵심 규칙(금고 조건/상태 전이/만료 정책)은 서비스 레이어로 이동했다
- [ ] 서비스 함수는 입력/출력 계약이 명확하다(요청 스키마/응답 스키마와 대응)
- [ ] 서비스가 DB 접근을 완전히 추상화하지 못하더라도(현 구조상) 책임이 분리되었다

완료 기준:
- [ ] `backend: pytest (docker)` 통과

---

## 8. Phase 4: 프론트엔드 리팩토링(현 구조 존중)
주의: 이 레포는 Next.js Pages Router 기반이므로, 불필요한 App Router 전환은 하지 않는다.

체크리스트:
- [ ] v3 변경은 `frontend/components/admin-v2/` 및 관련 API proxy에 “최소 변경”으로 반영했다
- [ ] 프론트에서 규칙을 재구현하지 않았다(가능하면 서버 계산 결과를 표시)

완료 기준:
- [ ] `frontend: lint` 통과

---

## 9. Phase 5: DB 마이그레이션
대상: `docs/DB_MIGRATION_V3.sql`

체크리스트:
- [ ] Expand → Migrate → Contract 순서로 배포 가능하도록 설계했다
- [ ] 컬럼 추가는 DEFAULT/NOT NULL 정책을 안전하게 잡았다
- [ ] 인덱스/제약은 운영 부하를 고려했다(필요시 후순위)

완료 기준:
- [ ] 로컬/도커 환경에서 마이그레이션 적용 후 API 스모크 OK

---

## 10. P0 기능 체크리스트: 골드 미션 O/X 토글 (v3)
설계 출처: `docs/REFACTORING_PLAN_V3.md`의 2.6

### 10.1 DB
- [ ] `vault_status`에 컬럼 추가
  - [ ] `gold_mission_1_done` BOOLEAN NOT NULL DEFAULT FALSE
  - [ ] `gold_mission_2_done` BOOLEAN NOT NULL DEFAULT FALSE
  - [ ] `gold_mission_3_done` BOOLEAN NOT NULL DEFAULT FALSE

### 10.2 백엔드 API
- [ ] 엔드포인트 신설: `POST /api/vault/admin/users/{user_id}/vault/gold-missions`
- [ ] 멱등키 지원: `x-idempotency-key` 필수(현 패턴과 동일)
- [ ] 감사로그 액션 분리: `ADMIN_GOLD_MISSIONS_UPDATE`
- [ ] 상태 자동 계산 규칙 구현
  - [ ] `gold_status`가 `CLAIMED/EXPIRED`면 자동 변경하지 않는다
  - [ ] 그 외는 (m1&m2&m3)면 UNLOCKED, 아니면 LOCKED

### 10.3 프론트(Admin v2)
- [ ] 유저 상세 패널에 “골드 미션(O/X)” 섹션 추가
- [ ] 토글 변경 → 즉시 저장(권장) 또는 명시적 Save(팀 합의)
- [ ] 실패 시 토글 롤백 + 에러 토스트

### 10.4 Next API Proxy
- [ ] 프록시 추가: `/pages/api/vault/admin/users/[userId]/vault/gold-missions.js`
- [ ] `x-admin-password`/`x-idempotency-key` 전달

### 10.5 테스트
- [ ] `test_admin_gold_missions_v3.py` 추가
- [ ] 조합 테스트: m1/m2/m3 변경에 따른 LOCKED↔UNLOCKED
- [ ] CLAIMED 보호 규칙이 깨지지 않는다
- [ ] 멱등 재시도 시 동일 결과(가능하면)

완료 기준:
- [ ] `backend: pytest (docker)` 통과
- [ ] `frontend: lint` 통과

---

## 11. 배포/롤백 체크리스트(최소)
- [ ] DB 먼저 적용(Expand)
- [ ] BE 배포(새 엔드포인트 추가 — 기본 UX에 영향 없게)
- [ ] FE 배포(토글 UI 노출)
- [ ] 문제 발생 시: FE에서 토글 UI 비활성화(또는 라우트 숨김)로 즉시 완화

---

## 12. 오늘 바로 할 “다음 3개”(추천)
- [ ] Phase 5(DB): 골드 미션 컬럼 3개 추가를 `docs/DB_MIGRATION_V3.sql`에 반영
- [ ] Phase P0(BE): `POST /.../gold-missions` 엔드포인트 + 감사로그 + 멱등
- [ ] Phase P0(FE): Admin v2 유저 상세 패널에 토글 UI + 프록시 라우트
