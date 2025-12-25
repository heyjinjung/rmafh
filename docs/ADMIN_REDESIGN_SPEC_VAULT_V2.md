# ADMIN_REDESIGN_SPEC_VAULT_V2

## 1. 메타
- 문서명: Vault v2 어드민 프론트엔드 전면 리디자인 + 멱등성/백엔드 개선 설계
- 문서 버전: v1.0.2
- 문서 상태: FINAL (확정)
- 변경 관리: v1.0.2 이후 변경은 PR + FE/BE/OPS 승인 필요
- 작성일: 2025-12-26
- 작성자: Codex (설계 초안)
- 검토 대상: FE/BE/OPS

## Changelog
- 2025-12-26 v1.0.2: Admin API 경로/요청·응답 스키마 정오표 반영 (audit-log, users page/page_size, imports rows/error_report_csv).
- 2025-12-26 v1.0.1: 문서 확정, 변경 관리 기준 명시.
- 2025-12-26 v1.0.0: 신규 어드민 UX 설계, 고용량 데이터 처리 흐름, API/멱등성/DB 변경 정의.

## 2. 요약 (핵심 결정)
- 어드민을 “데이터 운영 콘솔”로 재설계하고, 대량/반복 업무를 위한 데이터 그리드 + 작업(Job) 기반 UX로 전환한다.
- 모든 변경성 API에 멱등성 키를 의무화하고, 백엔드 공통 멱등성 레이어와 작업 큐/감사 로그를 연동한다.
- CSV 일일 업로드는 **비동기 Job + 미리보기 + 검증/오류 리포트** 흐름으로 재구성한다.
- 사용자/작업/알림/감사 로그를 통합하는 IA를 만들고, 필터/세그먼트/저장된 뷰를 제공한다.
- 기존 API는 호환 유지하되, 신규 v2 어드민 엔드포인트와 데이터 모델을 추가한다.

## 3. 문제 진단 (현행 UX/기술 제약)
### 3.1 UX 병목
- 사용자 검색/리스트가 1000건 한정 + 페이지네이션/정렬 부재로 대량 운영에 비효율적이다.
- 작업이 폼 중심으로 분산되어 “대상 선정 → 검증 → 실행 → 결과 확인”의 흐름이 끊긴다.
- 반복성 높은 액션(만료 연장, 알림 전송, 상태/입금 조정)에 대한 배치/세그먼트 기능이 없다.
- CSV 업로드는 실패/부분 성공/오류 리포트가 부족해 재시도 비용이 크다.
- 작업 실행 시 영향 범위(대상 수, 변경량)가 사전에 명확히 보이지 않는다.

### 3.2 기술 병목
- 변경성 API의 멱등성 규칙이 엔드포인트마다 상이하거나 부재하다.
- 대량 처리 작업이 동기 실행되어 타임아웃 위험이 높다.
- 감사 로그가 존재하지만 UI에서 조회/필터/추적이 어렵다.

## 4. 목표 및 범위
### 4.1 목표
- 대량 데이터 처리의 클릭 수/실행 시간을 50% 이상 단축
- 작업 재시도 시 중복 처리(중복 알림/중복 연장/중복 업데이트) 0건
- CSV 업로드 실패율 및 재작업 시간 50% 감소

### 4.2 범위
- 어드민 UI 전면 리디자인 (정보 구조, 화면 구성, 상호작용)
- 백엔드 멱등성 레이어 도입 및 Admin API 확장
- 작업(Job) 기반 비동기 처리 구조 설계

### 4.3 비범위 (이번 문서에서 제외)
- 사용자(일반 FE) UX 변경
- 실시간 알림 발송 엔진 외부 연동 구현 상세
- 관리자 계정/권한 RBAC의 최종 구현 (요구사항 정의만 포함)

## 5. UX 전략 및 디자인 원칙
- 대상 중심: “누구에게/무엇을/얼마나”를 항상 상단에 노출한다.
- 작업 중심: 모든 변경성 액션을 Job으로 묶고 상태/결과/감사를 통합한다.
- 멱등성 기본값: 실행/재시도 UI는 항상 idempotency key를 자동 생성/표시한다.
- 프리뷰 우선: 대량 작업은 드라이런(Shadow)과 영향 범위 미리보기를 기본 제공한다.
- 고밀도/명확성: 데이터 그리드는 밀도를 높이되, 강조/태그/컬러 룰을 명확히 한다.
- 안전한 확인: 위험 작업은 명시적 확인(텍스트 입력)과 2단계 확인을 요구한다.

## 6. 정보 구조 (IA)
```
Admin Console
├─ Dashboard (요약/경고/최근 작업)
├─ Users (데이터 그리드 + 상세 패널)
├─ Imports (CSV 업로드/검증/Job)
├─ Operations (만료 연장/상태 변경/일괄 업데이트)
├─ Notifications (알림 발송/리스트/재시도)
└─ Audit & Jobs (감사 로그/Job 히스토리)
```

## 7. 비주얼 시스템 (신규 어드민 톤)
- 톤: “차분한 다크 콘솔 + 데이터 밀도 강조”
- 타이포그래피
  - 헤드라인: Sora SemiBold (또는 IBM Plex Sans SemiBold)
  - 본문: IBM Plex Sans KR
  - 데이터/ID: JetBrains Mono
- 컬러
  - 배경: #101214 / #16191E
  - 강조: 라임-골드 계열 (#B7F75A), 경고 오렌지 (#F08C3A)
  - 상태 태그: LOCKED(Neutral), UNLOCKED(Green), CLAIMED(Blue), EXPIRED(Red)
- 배경: 미세 그리드 + 소프트 그라디언트, 섹션별 은은한 구분 레이어

## 8. 화면 상세 설계
### 8.1 전역 레이아웃
- 좌측 고정 내비게이션: 섹션/배지/즐겨찾기
- 상단 바: 글로벌 검색(External ID, 닉네임), 최근 작업 드롭다운, 빠른 실행
- 우측 컨텍스트 패널: 선택 대상 요약, 최근 실행 결과, Job 상태

### 8.2 Dashboard
- KPI 카드: 오늘 업로드/변경/알림 발송 수, 실패율
- 최근 작업: Job 상태, 영향 대상 수, 재시도 버튼
- 위험 경고: 실패율 급증, 중복 요청 감지, 알림 큐 적체

### 8.3 Users (데이터 그리드 중심)
#### 8.3.1 데이터 그리드
- 기본 컬럼
  - external_user_id (고정 왼쪽, 모노스페이스)
  - nickname
  - joined_date
  - gold_status / platinum_status / diamond_status (태그)
  - platinum_attendance_days (현재/최대)
  - deposit_total / diamond_deposit_current
  - telegram_ok / review_ok (아이콘 토글)
  - expires_at
- 기능
  - 서버 사이드 페이지네이션 + 무한 스크롤 옵션
  - 컬럼 정렬 (날짜/숫자/상태)
  - 컬럼 세트 저장 (예: “만료 관리”, “입금/출석”, “알림 대상”)
  - 대량 선택 (현재 페이지/필터 전체/ID 리스트 업로드)

#### 8.3.2 필터/세그먼트 빌더
- 조건: 상태, 만료 기간, 입금 금액 범위, 출석 수, 텔레그램/리뷰 여부
- 저장된 세그먼트: 이름, 설명, 소유자, 마지막 실행일
- 세그먼트 → 바로 작업 생성 (Operations 탭으로 이동)

#### 8.3.3 유저 상세 패널 (Drawer)
- Overview: 기본 정보 + 만료/상태 스냅샷
- Vault: 출석/입금/상태 변동 히스토리
- Actions: 상태/출석/입금 조정 + idempotency key
- Activity: 감사 로그 타임라인 (최근 20건)

### 8.4 Imports (CSV 업로드)
#### 8.4.1 업로드 4단계 흐름
1) 파일 선택/드래그
2) 컬럼 매핑 + 검증 규칙 확인
3) 미리보기(최대 200행) + 오류 리포트
4) 적용 모드 선택
   - Shadow(미리보기) / Apply(실제 반영)

#### 8.4.2 CSV 검증 규칙
- external_user_id 필수, 최대 128자
- 중복 ID 자동 제거 + 제거 목록 제공
- 날짜/숫자 파싱 오류는 “에러 리스트”로 분리
- 10,000행 이상은 자동 분할 Job 생성

#### 8.4.3 결과/오류 리포트
- 처리 요약: total/processed/updated/created/failed
- 오류 파일 다운로드 (CSV)
- idempotency key와 Job ID 제공

### 8.5 Operations (대량 작업)
#### 8.5.1 만료 연장 (extend-expiry)
- 대상 선택: 세그먼트/현재 필터/직접 ID
- 입력: extend_hours(1~72), reason(OPS/PROMO/ADMIN), shadow
- 영향 미리보기: 대상 수, 샘플 ID, 예상 만료일
- 위험 확인: “EXTEND 24H” 입력 후 실행

#### 8.5.2 상태/출석/입금 일괄 변경
- 상태 변경: LOCKED/UNLOCKED/EXPIRED
- 출석 조정: delta 또는 set
- 입금/플래그 변경: deposit_total, telegram_ok, review_ok
- 변경 전/후 diff 요약 제공

#### 8.5.3 작업 결과 화면
- Job 상세: 대상 수, 성공/실패, 재시도 버튼
- 실패 항목 다운로드 (CSV)

### 8.6 Notifications
- 알림 생성: type, variant, 대상(세그먼트/ID), 예약 시간
- 중복 방지 정책 표시: “같은 날/같은 type/variant” 디듑
- 발송 결과: 상태별 필터, 재시도/삭제 액션

### 8.7 Audit & Jobs
- 감사 로그 테이블: action, 대상 수, request_id, 결과 요약
- Job 테이블: status, created_at, duration, 실패율
- 필터: 기간/액션/관리자/IP/request_id

## 9. 공통 UX 패턴
- 대량 선택 바: 선택 수, “필터 전체 적용” 토글
- Impact 프리뷰: 실행 전 대상 수/샘플/예상 변경량
- 멱등성 키 위젯: 자동 생성, 복사, 재생성
- 위험 작업 확인: 텍스트 입력 + 2단계
- 결과 토스트 + 상세 패널 링크
- 단축키: `/` 검색, `g u` Users, `g i` Imports, `g o` Operations

## 10. 데이터 모델 (FE)
### 10.1 UserListRow
```json
{
  "user_id": 123,
  "external_user_id": "ext-001",
  "nickname": "홍길동",
  "joined_date": "2025-12-10",
  "gold_status": "UNLOCKED",
  "platinum_status": "LOCKED",
  "diamond_status": "LOCKED",
  "platinum_attendance_days": 2,
  "max_attendance_days": 5,
  "deposit_total": 120000,
  "diamond_deposit_current": 120000,
  "telegram_ok": true,
  "review_ok": false,
  "expires_at": "2025-12-26T00:00:00Z"
}
```

### 10.2 Job
```json
{
  "job_id": "job_20251226_001",
  "type": "DAILY_IMPORT",
  "status": "RUNNING",
  "target_count": 1200,
  "processed": 300,
  "failed": 2,
  "request_id": "imp-1700000000-abc",
  "created_at": "2025-12-26T02:10:00Z"
}
```

## 11. API 변경 사항 (신규/확장)
### 11.1 사용자 리스트 (페이지네이션/필터)
```
GET /api/vault/admin/users
query:
  query, status, sort_by, sort_dir, page, page_size
```
응답: `users`, `total`, `page`, `page_size`

### 11.2 사용자 상세
```
GET /api/vault/admin/users/{user_id}
```
응답: 스냅샷 + vault + 최근 감사 로그 요약

### 11.3 대량 작업(Job) 생성
```
POST /api/vault/admin/jobs
Headers: X-Idempotency-Key
Body: { type, target, payload, dry_run }
```
응답: `{ job_id, status, request_id }`

### 11.4 Job 상태/결과
```
GET /api/vault/admin/jobs
GET /api/vault/admin/jobs/{job_id}
GET /api/vault/admin/jobs/{job_id}/items
POST /api/vault/admin/jobs/{job_id}/retry
```

### 11.5 CSV 업로드
```
POST /api/vault/admin/imports
Headers: X-Idempotency-Key
Body: { mode: "SHADOW" | "APPLY", rows: [...] }
```
응답: `{ shadow, total, processed, identity_created, vault_rows_updated, dedup_removed, errors, job_ids?, error_report_csv? }`

### 11.6 감사 로그
```
GET /api/vault/admin/audit-log
query: action, endpoint, request_id, job_id, idempotency_key, response_status, page, page_size, order
```

## 12. 멱등성 설계 (전 엔드포인트 공통)
### 12.1 규칙
- 모든 변경성 API(POST/PATCH/DELETE)는 `X-Idempotency-Key` 필수
- 키 재사용 시 동일 응답을 반환하고, 상태 헤더 제공
  - `Idempotency-Status: recorded | replayed | in_progress`
- 동일 키 + 다른 payload 재사용은 409 `IDEMPOTENCY_KEY_REUSE`

### 12.2 서버 처리 흐름
1) 요청 수신 → 키 검증 → request_hash 계산
2) idempotency 테이블 조회
3) 존재 + 완료 → 저장된 응답 반환 (replayed)
4) 존재 + 진행 중 → 202 또는 409 (in_progress)
5) 없음 → IN_PROGRESS 레코드 생성 → 실제 처리
6) 완료 → 응답 저장 + 상태 업데이트

### 12.3 저장 스키마 (신규)
```sql
CREATE TABLE idempotency_keys (
  key TEXT NOT NULL,
  scope TEXT NOT NULL,            -- admin_user or system scope
  endpoint TEXT NOT NULL,
  request_hash TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'IN_PROGRESS',
  response_status INTEGER,
  response_body JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '24 hours'),
  PRIMARY KEY (key, scope, endpoint)
);
CREATE INDEX IF NOT EXISTS idx_idempotency_expires ON idempotency_keys (expires_at);
```

## 13. 백엔드 변경 상세
### 13.1 공통 멱등성 모듈
- `backend/app/main.py`에 공통 처리 함수 추가
- 기존 `request_id` 파라미터는 `X-Idempotency-Key`로 매핑

### 13.2 Job 테이블 (신규)
```sql
CREATE TABLE admin_jobs (
  job_id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING',
  request_id TEXT NOT NULL,
  target_count INTEGER NOT NULL DEFAULT 0,
  processed INTEGER NOT NULL DEFAULT 0,
  failed INTEGER NOT NULL DEFAULT 0,
  payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### 13.3 기존 API 멱등성 적용
- `/api/vault/user-daily-import` → request_id 추가, Job 전환
- `/api/vault/extend-expiry` → idempotency 테이블 우선 처리
- `/api/vault/notify` → request_id 추가, 중복 요청시 동일 응답 반환
- `/api/vault/admin/users/*` 변경성 API에 idempotency 적용

### 13.4 감사 로그 확장
- admin_audit_log에 `job_id`, `idempotency_key` 기록
- UI에서 request_id 기반 추적 가능하도록 필드 정규화

## 14. 프론트엔드 구현 가이드
### 14.1 상태/데이터
- `@tanstack/react-query` 기반 서버 상태 관리
- 대량 목록은 cursor 기반 페이징 + `react-virtual`

### 14.2 API 클라이언트
- 공통 `withIdempotency()` 헬퍼
- 모든 변경성 요청에 자동 키 생성/첨부

### 14.3 라우팅
- `/admin` → 기존 유지
- `/admin/v2` → 신규 콘솔 (단계적 전환)

## 15. 전환 계획 (Migration)
1) 백엔드 멱등성/Job API 추가 (현행 UI 유지)
2) 신규 `/admin/v2` 개발 및 병행 운영
3) 운영 안정화 후 `/admin` 기본 라우팅 전환

## 16. 테스트/QA 체크리스트
- 동일 idempotency key 재시도 시 결과 동일
- CSV 업로드 실패 시 오류 리포트 생성 확인
- 대량 작업 실행/취소/재시도 동작 확인
- 세그먼트/필터 대상 수 일치성 확인
- 감사 로그에 request_id/job_id 기록 여부

## 17. 리스크 및 가정
- 대량 작업 성능 확보를 위해 DB 인덱스 최적화 필요
- 운영 환경에서 idempotency 키 재사용 정책 합의 필요
- 기존 API spec과 신규 spec의 혼재 기간 관리 필요

## 18. 참고 자료
- 기존 어드민: `frontend/pages/admin.jsx`
- API 스펙: `docs/API_SPEC_VAULT_V2.md`
- 감사 로그: `docs/ADMIN_AUDIT_OPERATIONS_GUIDE.md`
- 백엔드 엔드포인트: `backend/app/main.py`
