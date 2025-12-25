# ADMIN_REDESIGN_CHECKLIST_VAULT_V2

## 1. 메타
- 문서명: Vault v2 어드민 리디자인 개발 체크리스트
- 문서 버전: v1.2.1
- 작성일: 2025-12-25
- 작성자: Codex
- 적용 범위: `/admin/v2`, 백엔드 Admin API, 멱등성/Job/감사 로그

## Changelog
- 2025-12-25 v1.2.0: Segments 백엔드 영속화(/api/vault/admin/segments) + segment_id 타겟팅 + Operations Extend-expiry 실제 Submit 연동 반영.
- 2025-12-25 v1.2.1: Notifications 예약 발송(scheduled_at) + retry/cancel 액션 연동, Jobs 실패 아이템 CSV 다운로드 연동 및 배포/롤백 플랜 초안 반영.
- 2025-12-25 v1.1.0: Users 벌크 타겟(필터/업로드/선택 IDs) → Operations 타겟 연결 및 행 클릭 우측 상세 패널 구현 반영.
- 2025-12-25 v1.0.9: 프론트엔드 체크리스트(섹션 5) 진행 현황/남은 작업을 실제 구현 기준으로 보강하고 체크박스 정합성 수정.
- 2025-12-25 v1.0.8: Admin v2 실제 구현 기준으로 문서의 Admin API 경로/파라미터/필드 정오표 반영 (audit-log, page/page_size/order, imports error_report_csv).
- 2025-12-25 v1.0.7: E2E admin 플로우 검증 추가 (import+extend, notify 리스트/재시도 가드, audit request_id, job timeout 스모크).
- 2025-12-25 v1.0.6: Notifications UI, Audit/Jobs UI, 공통 UX(idempotency 위젯/토스트/오류 표준) 스켈레톤 추가.
- 2025-12-25 v1.0.5: Admin v2 세그먼트 CRUD, Imports 4단계 UI, Operations UI(extend/impact/status/guardrail) 추가.
- 2025-12-25 v1.0.4: Admin v2 Users 그리드 서버 페이징/필터/정렬, 컬럼 세트/벌크 선택, idempotent FE 클라이언트 래퍼 적용.
- 2025-12-25 v1.0.3: Job/worker 경로 전반에 config 기반 lock/statement timeout을 적용.
- 2025-12-25 v1.0.2: Admin import 경로 lock/statement timeout을 config 값으로 적용.
- 2025-12-26 v1.0.1: 진행 현황 및 완료 항목 반영.
- 2025-12-26 v1.0.0: 최초 작성 (상세 구현/QA/배포 체크리스트).

## 2. 사용 가이드
- 체크박스는 “완료 기준”을 통과했을 때만 체크한다.
- API/DB 변경은 반드시 스키마 버전과 문서 업데이트를 동반한다.
- 멱등성 키/Job ID는 FE/BE 양쪽 로그에서 추적 가능해야 한다.

## 진행 현황 (2025-12-25)
- 완료: `docs/API_SPEC_VAULT_V2.md` Admin/Job/Idempotency 반영
- 완료: idempotency_keys/admin_jobs/admin_job_items 스키마 추가
- 완료: `/api/vault/admin/jobs` 스캐폴딩 + 목록/상세/아이템/재시도
- 완료: `/admin/v2` 라우트 + 레이아웃/대시보드 스켈레톤
- 진행 중: Job 처리 워커/상태 전이, Imports/Operations UI 연결
- 미착수: QA/부하/배포/보안 항목

## 3. 사전 준비
- [x] 요구사항 확정: `docs/ADMIN_REDESIGN_SPEC_VAULT_V2.md` FINAL 확인
- [ ] 범위 고정: 이번 릴리즈의 “Must/Should/Could” 구분 확정
- [ ] 기능 플래그 정의: `ADMIN_V2_ENABLED`, `ADMIN_IDEMPOTENCY_ENABLED`
- [ ] 테스트 데이터 준비: 대량 CSV 샘플(1k/10k/50k), 실패 케이스 샘플
- [ ] 모니터링 지표 목록 확정 (Job 실패율, 중복 요청, 응답 시간)

## 4. 백엔드/DB 체크리스트
### 4.1 멱등성 레이어
- [x] `idempotency_keys` 테이블 생성 및 인덱스 적용
- [x] 공통 유틸/미들웨어 설계 (key, scope, endpoint, request_hash)
- [x] `Idempotency-Status` 응답 헤더 추가 (admin/jobs only)
- [x] 동일 키/다른 payload 재사용 시 409 `IDEMPOTENCY_KEY_REUSE`
- [x] 만료 정책 적용 (24h 기본, 환경 변수로 조정 가능)
- [x] 서버 로그에 key/endpoint/status 기록

### 4.2 Job 시스템
- [x] `admin_jobs` 테이블 생성
- [ ] Job 상태 전이 정의: PENDING → RUNNING → DONE/FAILED/CANCELED
- [x] Job item 테이블 설계 (대상별 성공/실패/에러 메시지)
- [x] Job 생성 API 구현: `POST /api/vault/admin/jobs`
- [x] Job 조회 API 구현: 목록/상세/아이템/재시도
- [ ] 대량 작업 실패 시 부분 성공 처리 정책 정의

### 4.3 CSV 업로드 (Imports)
- [x] 업로드용 API: `POST /api/vault/admin/imports` 구현
- [x] Shadow vs Apply 모드 분리
- [ ] CSV 파싱 오류 리포트 생성 (CSV 다운로드)
- [x] 10,000행 초과 시 분할 Job 처리
- [x] 중복 external_user_id 제거 및 제거 목록 제공

### 4.4 기존 API 멱등성 적용
- [x] `/api/vault/user-daily-import` → idempotency 적용 + Job 전환
- [x] `/api/vault/extend-expiry` → request_id → idempotency key 매핑
- [x] `/api/vault/notify` → idempotency 추가 + 중복 요청 방지
- [x] `/api/vault/admin/users/*` 변경성 요청에 idempotency 적용

### 4.5 감사 로그/보안
- [x] `admin_audit_log`에 `job_id`, `idempotency_key` 필드 추가
- [x] 모든 변경성 작업에 `_log_admin_action` 호출 확인
- [x] `ADMIN_PASSWORD` 기본값 제거 및 환경 변수 필수화 검토
- [x] 요청 헤더 `x-admin-password` 누락 시 401 일관 처리

### 4.6 성능/쿼리
- [x] 사용자 리스트 API 페이지네이션/정렬/필터 인덱스
- [x] 대량 업데이트 SQL 배치 처리 (execute_values)
 - [x] Job 처리 타임아웃/락 타임아웃 설정 (관리자 import/관리자 job/worker 경로에 config 기반 lock/statement timeout 적용)

## 5. 프론트엔드 체크리스트
### 5.0 진행 현황 요약 (2025-12-25)
- 현재까지 “실제 API 연동 완료” 영역: Dashboard KPI(최근 Job/Notify/Audit), Jobs/Audit, Notifications(생성+리스트), Imports(SHADOW 검증+오류 테이블+CSV 링크), Users(리스트 조회).
- 현재까지 “UI만 있고 서버 연동 없음/미흡” 영역: Notifications(예약 발송/재시도/상태 변경), Jobs(실패 아이템 CSV 다운로드).
- FE 공통 UX: `withIdempotency` 기반 요청 헤더 주입 + 표준 에러 파싱 + 토스트(성공/실패)까지 동작.

#### 다음 해야할 일 (우선순위)
- P0(필수): Notifications 예약 발송(scheduled_at) 및 재시도/상태 변경 액션(백엔드 지원 범위 확인 후).
- P1: Jobs 실패 아이템 다운로드(CSV) UX + 서버 엔드포인트/다운로드 연결.

### 5.1 라우팅/구조
- [x] `/admin/v2` 신규 라우트 추가
- [x] 기존 `/admin` 유지 + 전환 플래그 구현
- [x] API 클라이언트 공통화 (`withIdempotency`)

### 5.2 전역 레이아웃
- [x] 좌측 네비게이션 + 상단 검색 + 컨텍스트 패널 구현 (스켈레톤)
- [x] 글로벌 검색: external_user_id, nickname, user_id 지원 (skeleton)
- [x] 빠른 실행 (Extend/Notify/Import) 진입 지원 (skeleton)

### 5.3 Users (데이터 그리드)
- [x] 서버 사이드 페이징/정렬/필터 연동 (`GET /api/vault/admin/users?page&page_size&sort_by&sort_dir&query&status`)
- [x] 가상 스크롤 적용 (간이 virtualized table)
- [x] 컬럼 세트 저장/불러오기 (localStorage)
- [x] 대량 선택: 필터 전체/ID 업로드/선택 IDs를 Operations 타겟으로 연결 (실행 API는 5.6에서 진행)
- [x] 행 클릭 → 우측 Drawer(우측 상세 패널) 표시 (백엔드에 `GET /api/vault/admin/users/{user_id}` 없음 → 현재는 리스트 응답 필드만 노출)

### 5.4 세그먼트/필터
- [x] 세그먼트 생성/저장/삭제 (백엔드 영속화)
- [x] 필터 조건 UI: 상태, 만료, 입금 범위, 출석 범위, 텔레그램/리뷰
- [x] 세그먼트 백엔드 저장/삭제/조회 API 연동 (`GET|POST|DELETE /api/vault/admin/segments`)
- [x] 세그먼트 → Operations 타겟팅 연동 (segment_id 기반 `POST /api/vault/admin/operations/extend-expiry`)

### 5.5 Imports UI
- [x] 4단계 업로드 흐름 구현 (파일 → 매핑 → 검증 → 실행)
- [x] 미리보기(최대 200행) 테이블
- [x] 오류 리스트/다운로드 링크 표시
- [x] Shadow/Apply 모드 토글 + 위험 확인

### 5.6 Operations UI
- [x] Operations UI 스켈레톤 (대상/연장/상태/출석/입금/가드레일 입력)
- [x] Extend-expiry API 연동 (IDs: `POST /api/vault/extend-expiry`, Filter/Segment: `POST /api/vault/admin/operations/extend-expiry`, shadow/apply)
- [x] 상태/출석/입금 bulk 변경 API 연동 (`POST /api/vault/admin/operations/bulk-update`, IDs/Filter/Segment 지원)
- [x] Impact 프리뷰 실제 계산 연동 (`POST /api/vault/admin/targets/preview`)
- [x] Submit Operation 버튼 동작 + 결과 토스트 + 감사 로그 연결 (extend-expiry 범위)

### 5.7 Notifications UI
- [x] 알림 생성 폼 (type/variant/대상) + `POST /api/vault/notify`
- [x] 예약 발송 입력(scheduled_at) 및 서버 파라미터 연동
- [x] 중복 방지 정책 안내 문구 표시
- [x] 알림 리스트 필터/페이지네이션 (`GET /api/vault/admin/notifications?page&page_size&order&status&external_user_id`)
- [x] 재시도/상태 변경 액션 (`POST /api/vault/admin/notifications/{id}/retry|cancel`)

### 5.8 Audit & Jobs UI
- [x] 감사 로그 테이블 + 필터
- [x] Job 리스트/상세 (리스트 + 상세(처리/실패 수) 병합 표시)
- [x] Job 실패 아이템 다운로드 (`GET /api/vault/admin/jobs/{job_id}/items?format=csv&failed_only=true`)
- [x] Job 재시도 버튼 + 상태 업데이트

### 5.9 공통 UX
- [x] 멱등성 키 위젯 (자동 생성/복사/재생성)
- [x] 결과 토스트 + 상세 패널 링크
- [x] 오류 메시지 표준화 (코드/요약/세부)

## 6. API 스펙/문서 업데이트
- [x] `docs/API_SPEC_VAULT_V2.md`에 신규 Admin API 추가
- [x] `docs/ADMIN_GUIDE_VAULT_V2.md`에 `/admin/v2` 가이드 추가
- [x] `docs/ADMIN_AUDIT_OPERATIONS_GUIDE.md`에 job/idempotency 필드 추가
- [x] `docs/CSV_UPLOAD_COLUMN_GUIDE.md`에 업로드 검증 규칙 업데이트

## 7. 테스트/QA 체크리스트
### 7.1 단위 테스트
- [x] 멱등성 키 재사용 시 동일 응답 반환 (pytest: admin job/notify idempotency)
- [x] 다른 payload 재사용 시 409 반환 (pytest: admin job idempotency conflict)
- [x] Job 상태 전이 정상 처리 (pytest: admin job state transitions)

### 7.2 통합 테스트
- [ ] 대량 CSV 업로드 Shadow/Apply 경로
- [x] Extend-expiry Shadow/Apply 경로 (pytest)
- [x] Notify 중복 방지 동작 (pytest)
- [x] User admin update 일괄 적용 검증 (pytest: admin user bulk updates)

### 7.3 E2E 시나리오
- [ ] 세그먼트 생성 → 대량 연장 → 결과 확인
	- 목적: Saved Segment 기반으로 Extend Expiry를 Shadow→Apply로 1회씩 실행하고, Users/Audit에서 결과를 검증한다.
	- 사전 조건
		- `/admin/v2` 접속 + Admin Password 입력 완료
		- E2E 대상이 0명이 되지 않도록(=Impact Preview candidates가 0이 되지 않도록) 세그먼트 필터를 단순하게 설정 권장
	- 절차(클릭/입력 포인트)
		1) Segments 섹션에서 세그먼트 생성
			- `Segment Name`에 예: `e2e_unlocked_only` 입력
			- `Status`에서 1개만 선택(권장: `UNLOCKED`)하고, 나머지 필터(Expires/Deposit/Attendance/Telegram/Review)는 비움
			- `Save Segment` 클릭
			- 우측 `Saved Segments` 목록에서 방금 만든 세그먼트의 `Apply` 클릭
			- 통과 기준: `Apply` 클릭 후 세그먼트가 선택(하이라이트)되고, 이후 Operations에서 세그먼트 타겟팅 오류가 발생하지 않는다.
		2) Users 섹션에서 검증용 샘플 1명 선정(Apply 전/후 비교용)
			- `Status` 필터를 세그먼트와 동일하게 맞춤(예: `UNLOCKED`)
			- 임의의 행 1개를 클릭 → 우측 상세 패널 `Show` → `external_user_id`와 기존 `expires_at` 값을 기록
		3) Operations 섹션에서 Extend Expiry (Shadow) 실행
			- `Target Scope`에서 `Saved Segment` 선택(기본값)
			- `Extend Expiry` 영역에서 `Shadow mode` 체크(기본값 true)
			- `Days to extend` = 1 (주의: 내부적으로 24h로 변환되며, 1~3일 범위만 허용)
			- `Reason` = OPS/PROMO/ADMIN 중 선택(권장: OPS)
			- `Safety` 영역에서 입력칸에 `apply` 입력 → 버튼 활성화 확인
			- `Submit Extend Expiry (idempotent)` 클릭
			- 통과 기준: 토스트에 `Extend Expiry (Shadow) 프리뷰`가 표시되고 `candidates: N`(N>0)이 노출된다.
		4) Audit Log에서 Shadow 실행 기록 확인
			- `Audit & Jobs` 섹션 → `Audit Log` 영역
			- 통과 기준: 방금 실행의 request_id(토스트 기준)로 검색 시, `endpoint`가 `.../operations/extend-expiry`이고 `Status=SUCCESS`인 로그가 확인된다.
		5) Operations 섹션에서 Extend Expiry (Apply) 실행
			- 동일 설정 유지한 채 `Shadow mode` 체크 해제(false)
			- `Submit Extend Expiry (idempotent)` 클릭
			- 통과 기준: 토스트에 `Extend Expiry 적용 완료`가 표시되고 `updated: N`(N>0), `new_expires_at`가 노출된다.
		6) Users에서 Apply 결과 확인(샘플 1명)
			- Users `Query`에 2)에서 기록한 `external_user_id`를 입력해 해당 사용자로 좁힘
			- 행 클릭 → 상세 패널에서 `expires_at`이 Apply 전보다 +1일(또는 +24h) 증가했는지 확인
			- 통과 기준: `expires_at` 변경이 확인되며, 5)의 `new_expires_at`과 정합(시간대 차이는 허용)하다.
	- 참고/트러블슈팅
		- candidates가 0이면: 세그먼트 필터를 단순화(예: Status만 사용)하거나, 운영 DB 데이터 분포(해당 status 존재 여부)를 먼저 확인
		- Apply 버튼이 비활성/실패하면: `Safety` 입력에 정확히 `apply`(소문자) 입력되어 있는지 확인
		- 이 플로우는 Job을 생성하지 않는다(Extend Expiry는 audit에 기록). Job 기반 검증은 Bulk Update/Imports 시나리오에서 수행.
- [ ] CSV 업로드 → Job 완료 → 오류 다운로드
- [x] 알림 발송 → 리스트 조회 → 재시도
- [x] 감사 로그에서 request_id 추적
- [x] Job 처리 중 API 응답 타임아웃 발생 여부

## 8. 보안/운영 체크리스트
- [ ] ADMIN_PASSWORD 미설정 시 서비스 부팅 차단 여부 검토
## 9. 배포/전환 체크리스트
- [x] 신규 DB 스키마 배포 계획 수립
- [x] 기능 플래그 ON/OFF 롤백 시나리오 작성
- [ ] 운영자 매뉴얼 배포 및 교육 진행

### 9.1 신규 DB 스키마 배포 계획(초안)
- 목표: 무중단(또는 최소 다운타임)으로 신규 테이블/인덱스/확장(pg_trgm 등) 반영 후, 기능 플래그로 단계적 노출.
- 원칙: "Expand → Migrate → Contract"(확장/이행/정리) 순서로 배포.
- 단계:
	1) (사전) 현재 운영 DB에 적용될 변경 목록 확정
		 - 신규 테이블: `admin_segments`, `idempotency_keys`, `admin_jobs`, `admin_job_items`, `admin_audit_log`(컬럼 추가), `notifications_queue`(scheduled_at 포함)
		 - 인덱스/확장: 사용자 검색/정렬용 인덱스, `pg_trgm`(가능한 경우)
	2) (배포 1) DB 변경 먼저 적용
		 - DDL은 별도 스크립트로 실행(권장)하고, 애플리케이션의 `_ensure_schema()`는 "best-effort" 보조 역할로만 사용
		 - 인덱스 생성은 `CONCURRENTLY` 옵션 사용(가능한 경우) + 트래픽 저점 시간대 수행
	3) (배포 2) 백엔드 배포
		 - 신규 엔드포인트는 기능 플래그 OFF 상태에서 배포해도 404/미노출이 되도록 라우팅/UX 보호
		 - 마이그레이션 직후, 헬스체크 + 핵심 Admin API 스모크(segments/jobs/notifications) 수행
	4) (배포 3) 프론트엔드 배포
		 - `/admin/v2` 화면 자체는 배포하되, 기능 플래그로 접근/버튼 활성화 제어
	5) (검증) 관측 지표
		 - Admin API 오류율(4xx/5xx), Job 실패율, idempotency 409 비율, notifications 상태 전이(FAILED/DLQ) 분포

### 9.2 기능 플래그 ON/OFF 롤백 시나리오(초안)
- 플래그 후보:
	- `ADMIN_V2_ENABLED`: `/admin/v2` 접근/네비게이션 노출
	- `ADMIN_IDEMPOTENCY_ENABLED`: Admin 변경성 요청에 멱등성 적용 강제(또는 경고 모드)
- 롤아웃:
	1) `ADMIN_V2_ENABLED=0`(기본)로 FE/BE 배포
	2) 내부 운영자만 `ADMIN_V2_ENABLED=1`로 사용(운영 환경에서는 allowlist 또는 별도 배포 슬롯 권장)
	3) 문제 없으면 점진 확대
- 롤백(즉시 대응):
	- UI 문제: `ADMIN_V2_ENABLED=0`으로 즉시 차단 → 기존 `/admin`로 회귀
	- 멱등성/Job 문제:
		- 신규 bulk/notify 경로에서 오류 증가 시 해당 버튼/액션을 FE에서 비활성화(또는 `ADMIN_IDEMPOTENCY_ENABLED=0`으로 완화)
		- job worker 관련 문제는 worker 컨테이너/프로세스만 중지하여 신규 처리만 멈추고, 데이터는 보존
	- DB 롤백 원칙: 이미 적용된 DDL은 일반적으로 되돌리지 않고(리스크 큼), 플래그 OFF로 기능만 차단 후 원인 분석/핫픽스

	### 9.3 운영자 매뉴얼 배포 및 교육 진행(완료 기준 포함)
	- 목적: 운영자가 “무엇을 눌러도 되는지/안되는지”, “장애 시 어떤 순서로 대응하는지”를 문서+리허설로 숙지.
	- 배포 대상 문서(최소):
		- `docs/ADMIN_GUIDE_VAULT_V2.md` (접속/권한/기본 동작)
		- `docs/ADMIN_AUDIT_OPERATIONS_GUIDE.md` (request_id/job/idempotency 추적)
		- `docs/RUNBOOK_VAULT_V2.md` (장애 대응/점검)
		- `docs/SERVER_DEPLOY_XMAS.md` 또는 배포 가이드(환경별 절차/체크)
		- 본 문서: `docs/ADMIN_REDESIGN_CHECKLIST_VAULT_V2.md` (릴리즈 체크리스트)
	- 교육(30~45분) 아젠다(권장):
		1) `/admin` vs `/admin/v2` 전환 원칙 및 기능 플래그 의미
		2) Operations: 영향(Impact) 확인 → Shadow → Apply 순서
		3) Jobs/Audit: request_id/job_id/idempotency_key로 추적하는 법
		4) Notifications: scheduled_at 의미, Retry/Cancel 허용 상태
		5) 실패 아이템 CSV 다운로드 및 재처리 루틴
		6) 롤백: UI 차단(플래그 OFF) + worker 중지 + 원인 분석 순서
	- 완료 기준(체크 요건):
		- 운영자 1명 이상이 실제로 E2E 1회 수행(세그먼트→대량 연장 또는 알림 예약→취소/재시도)
		- 교육 자료 링크/녹화/요약(슬랙/노션 등) 공유 완료
		- “긴급 대응 연락처/담당자”와 “롤백 1줄 요약”이 RUNBOOK에 반영됨

## 10. 최종 승인 체크리스트
- [ ] FE/BE/OPS 최종 승인
- [ ] QA 시나리오 전수 통과
- [ ] 문서/가이드 업데이트 완료
- [ ] 배포/롤백 플랜 승인

	### 10.1 FE/BE/OPS 최종 승인(완료 기준)
	- FE 승인: `npm run lint` 경고만(에러 0) + `/admin/v2` 주요 패널 렌더/기능 동작 스모크 완료
	- BE 승인: `backend: pytest (docker)` 통과 + 신규 API(notifications retry/cancel, job items csv) 스모크 완료
	- OPS 승인: 모니터링/알림(오류율/Job 실패율) 확인 경로 + 장애 시 조치 순서(runbook) 확인

	### 10.2 QA 시나리오 전수 통과(완료 기준)
	- E2E 최소 세트:
		- 세그먼트 생성 → 대량 연장(Shadow/Apply) → 결과 확인(Users/Jobs/Audit)
		- CSV 업로드 → Job 완료 → 오류 CSV 다운로드
		- 알림 예약(scheduled_at) → 리스트 조회 → (상태 조건 충족 시) Retry/Cancel
	- 회귀 체크:
		- 기존 `/admin` 플로우 영향 없음
		- Admin password 누락 시 401 일관

	### 10.3 문서/가이드 업데이트 완료(완료 기준)
	- 다음 문서들의 “실제 구현”과의 정합성 점검 완료(최소 1회):
		- `docs/API_SPEC_VAULT_V2.md`
		- `docs/ADMIN_GUIDE_VAULT_V2.md`
		- `docs/ADMIN_AUDIT_OPERATIONS_GUIDE.md`
		- `docs/RUNBOOK_VAULT_V2.md`
		- `docs/ADMIN_REDESIGN_CHECKLIST_VAULT_V2.md`

	### 10.4 배포/롤백 플랜 승인(완료 기준)
	- 스테이징(또는 로컬 docker)에서 “플래그 ON/OFF” 드라이런 1회 수행
	- 배포 체크리스트(섹션 9) 기반으로 담당자(OPS/BE/FE) 서명/승인 기록 남김

	## 11. 참고(향후 개선 제안)
	먼저 빠르게 체감시킬 변경(순서 제안)

Admin v2 대시보드 상단에 “최근 Job/Notify/Audit” 카드 + 상태 배지 추가: AdminV2KpiCards.jsx, AdminV2JobsPanel.jsx 확장. 데이터 소스는 /api/vault/admin/jobs?page=1&page_size=5&order=desc(상태/updated_at), /api/vault/admin/notifications?page=1&page_size=5&order=desc(type/state), 감사 로그는 /api/vault/admin/audit-log?page=1&page_size=5&order=desc(request_id, admin_user, action) 목록 노출.
공통 오류/토스트: withIdempotency(frontend/lib/apiClient.js 예상) 응답에서 code/summary/detail, idempotency-key, Idempotency-Status를 추출해 전역 에러 핸들러로 토스트/패널에 표준 포맷 표시. UI 훅/컴포넌트는 AdminV2CommonUxPanel.jsx 예제/코드와 전역 토스트(예: useToast) 연결.
CSV 업로드 오류 다운로드: AdminV2ImportsFlow.jsx에 업로드 응답의 오류 리포트 링크(백엔드에서 제공하는 error_report_csv)를 버튼으로 노출하고, 파일 다운로드 핸들러 추가. 검증 단계에서 오류 테이블 + “CSV로 저장” 버튼 표시.
화면/컴포넌트별 API 연결 매핑

Dashboard KPI/Recent: AdminV2KpiCards.jsx, AdminV2JobsPanel.jsx → /api/vault/admin/jobs, /api/vault/admin/notifications, /api/vault/admin/audit-log.
Users/Grid: AdminV2UsersGrid.jsx → `GET /api/vault/admin/users` 연동 완료 (page/page_size/sort_by/sort_dir/query/status).
Segments: AdminV2SegmentsPanel.jsx → 현재 localStorage 기반 드래프트만 구현. 백엔드 세그먼트 저장/segment_id 타겟팅 엔드포인트 추가 또는 UX 재정의 필요.
Operations: AdminV2OperationsPanel.jsx → 현재 폼/가드레일 UI만 존재. 실제 실행은 /api/vault/extend-expiry 및 /api/vault/admin/users/*(vault/status|attendance|deposit) 연동 필요.
Notifications: AdminV2NotificationsPanel.jsx → /api/vault/notify 생성, /api/vault/admin/notifications 목록/필터. 재시도는 알림 단위가 아니라 Job(/api/vault/admin/jobs/{id}/retry) 단위로 지원.
Imports: AdminV2ImportsFlow.jsx → /api/vault/admin/imports (mode SHADOW/APPLY, rows), 응답의 job_ids/errors/error_report_csv를 UI에 표시. 미리보기 테이블에 서버 검증 오류도 표시.
Common UX: AdminV2CommonUxPanel.jsx → idempotency 데모를 실 UI 토스트/에러 패널과 동일 포맷으로 통합.
우선순위 제안

P0: Operations(extend-expiry + users vault 업데이트) 실제 API 연결 + 결과를 Audit/Jobs에서 추적 가능하게.
P0: Segments를 백엔드 저장/segment_id 타겟팅으로 확정(미지원이면 UI/문구로 명시).
P1: Users Grid 벌크 선택(필터 전체/ID 업로드)을 Job/Operations 타겟으로 연결.
P2: Job items 다운로드(`/api/vault/admin/jobs/{job_id}/items`) 및 감사 로그 Export 버튼 구현.