# Vault v2.0 DB 설계

## 1. 메타
- 문서 타입: DB 설계
- 버전: v0.2 (초안)
- 작성일: 2025-12-20
- 대상: 백엔드/DBA

## 1.1 현재 구현 상태(2025-12-20)
- 운영 기준 스키마는 [docs/DB_MIGRATION_VAULT_V2.sql](DB_MIGRATION_VAULT_V2.sql) 적용을 권장합니다.
- 로컬/테스트에서는 `backend/app/main.py`의 `_ensure_schema()`가 최소 동작을 위한 스키마를 자동 보강하며,
  - ENUM 대신 TEXT,
  - 일부 컬럼(`expires_initial_at` 등)은 생략
  형태로 단순화되어 있을 수 있습니다.

## 2. 테이블: vault_status
- 목적: 유저별 금고 상태/진행률/만료 관리
- 스키마
  - user_id INT PK, FK user.id
  - gold_status ENUM(LOCKED, UNLOCKED, CLAIMED, EXPIRED) NOT NULL DEFAULT LOCKED
  - platinum_status ENUM(LOCKED, UNLOCKED, CLAIMED, EXPIRED) NOT NULL DEFAULT LOCKED
  - diamond_status ENUM(LOCKED, UNLOCKED, CLAIMED, EXPIRED) NOT NULL DEFAULT LOCKED
  - platinum_attendance_days INT NOT NULL DEFAULT 0
  - platinum_deposit_done BOOLEAN NOT NULL DEFAULT 0
  - diamond_deposit_current INT NOT NULL DEFAULT 0
  - expires_initial_at DATETIME NOT NULL (가입 +7일, 원본 보존)
  - created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  - expires_at DATETIME NOT NULL (현재 유효 만료 시각, 연장 반영)
  - expiry_extend_count INT NOT NULL DEFAULT 0 (연장 횟수 제한/감사용)
  - last_extension_reason VARCHAR(32) NULL (OPS | PROMO | REFERRAL | ADMIN)
  - last_extension_at DATETIME NULL

### 2.1 테이블: vault_expiry_extension_log
- 목적: 만료 연장(부활권/운영/점검) 이력을 감사/중복 방지용으로 기록
- 스키마
  - id BIGSERIAL PK
  - user_id INT NOT NULL
  - prev_expires_at DATETIME NOT NULL
  - new_expires_at DATETIME NOT NULL
  - reason ENUM(OPS, PROMO, REFERRAL, ADMIN)
  - request_id VARCHAR(64) NOT NULL (멱등키)
  - shadow BOOLEAN NOT NULL DEFAULT false (드라이 런 여부)
  - metadata JSONB NULL (채널/캠페인/초대 코드 등)
  - created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
- 제약: UNIQUE (request_id), UNIQUE (user_id, reason='REFERRAL')로 1회 부활권 보장

### 2.2 테이블: notifications_queue (variant 확장)
- 목적: 알림/토스트/푸시 큐잉 + A/B 카피 분기
- 스키마(핵심 컬럼)
  - id BIGSERIAL PK
  - user_id INT NOT NULL
  - type ENUM(EXPIRY_D2, EXPIRY_D0, ATTENDANCE_D2, TICKET_ZERO, SOCIAL_PROOF)
  - vault_type ENUM(GOLD, PLATINUM, DIAMOND) NULL
  - variant_id VARCHAR(16) NULL (A/B 템플릿 선택)
  - dedup_key VARCHAR(128) NOT NULL (type+user+date+variant)
  - payload JSONB NOT NULL (카피/금액/타이머)
  - scheduled_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  - status ENUM(PENDING, SENT, FAILED, DLQ) NOT NULL DEFAULT PENDING
  - retry_count INT NOT NULL DEFAULT 0
  - created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP

### 2.3 테이블: compensation_queue
- 목적: CLAIMED 처리 중 외부 API 장애 시 멱등 재시도 보상 큐
- 스키마(핵심 컬럼)
  - id BIGSERIAL PK
  - user_id INT NOT NULL
  - vault_type ENUM(GOLD, PLATINUM, DIAMOND) NOT NULL
  - request_id VARCHAR(64) NOT NULL (claim 멱등키)
  - external_service VARCHAR(64) NOT NULL (예: POINTS, COUPON)
  - payload JSONB NOT NULL (보상 금액/쿠폰 정보)
  - status ENUM(PENDING, RETRYING, DONE, FAILED) NOT NULL DEFAULT PENDING
  - retry_count INT NOT NULL DEFAULT 0
  - next_retry_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  - last_error TEXT NULL
  - created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
- 제약: UNIQUE (request_id, external_service)

## 3. 인덱스 제안
- PK: (user_id)
- 보조: (expires_at), (platinum_status), (diamond_status)
- 유니크: user_id (단일 레코드 보장)
- extension_log: INDEX (user_id, created_at DESC), UNIQUE (request_id), UNIQUE (user_id) WHERE reason='REFERRAL'
- notifications_queue: INDEX (type, scheduled_at), UNIQUE(dedup_key), INDEX(variant_id, type)
- compensation_queue: UNIQUE (request_id, external_service), INDEX(status, next_retry_at)

### 3.1 추가 인덱스/옵션
- (platinum_attendance_days) partial: WHERE platinum_status <> 'CLAIMED' (출석 대상 조회 최적화)
- (diamond_deposit_current) partial: WHERE diamond_status <> 'CLAIMED' (누적 충전 진행률 조회)
- (expires_at, gold_status, platinum_status, diamond_status) 복합: 만료 배치/알림 필터 최적화

## 4. 데이터 시드/초기화
- 신규 가입 시 vault_status 생성, expires_at = 가입 + 7일
- 초기 상태: 모두 LOCKED (FE 라벨은 "보관 중")
- expires_initial_at = expires_at, expiry_extend_count = 0, last_extension_* = NULL

## 5. 파티셔닝/TTL 고려
- 파티셔닝: 활성+만료 분리 위해 expires_at 월 단위 파티션(혹은 RANGE) 고려. 활성 테이블은 작은 워킹셋 유지.
- TTL/아카이빙: expires_at 90일 지난 레코드는 archive 테이블로 이동하거나 청소 배치 수행 (규정/분석 요구에 따라 보존 기간 결정).
- 인덱스 유지: 오래된 파티션에 대한 인덱스 드랍/압축으로 비용 절감.


## 6. 운영 메모
- 만료 배치는 expires_at + 상태 != CLAIMED 조건으로 스캔하므로 만료 가까운 파티션 우선 처리
- idempotent 업데이트를 위해 상태 전이 시 WHERE 조건에 현재 상태 포함 (예: WHERE user_id=? AND platinum_status='LOCKED')
- shadow 모드 연장은 vault_expiry_extension_log에 shadow=true로 기록하되 vault_status는 미변경
- compensation_queue는 DONE/FAILED 30일 보존 후 청소, DLQ가 있다면 별도 테이블로 이동

## 7. 아카이빙 배치/뷰 예시
- 배치 스크립트 (예시: 하루 03:00 UTC)
```sql
INSERT INTO vault_status_archive
SELECT *, now() AS archived_at
FROM vault_status
WHERE expires_at < now() - interval '90 days';

DELETE FROM vault_status
WHERE expires_at < now() - interval '90 days';
```
- 물리 파티션을 쓰는 경우: 오래된 파티션 DETACH 후 압축/삭제.
- 뷰 예시 (최근 90일만 노출)
```sql
CREATE OR REPLACE VIEW vault_status_recent AS
SELECT *
FROM vault_status
WHERE expires_at >= now() - interval '90 days';
```
- 감사/이벤트 테이블이 별도라면 FK 없이 soft-link, 필요 시 join 시점에 기간 필터 필수.

## 8. 관측/모니터링
- 중요 이벤트: VAULT_UNLOCKED, VAULT_CLAIMED, VAULT_EXPIRED
- 메트릭: 금고별 CLAIMED 전환율, EXPIRED 비율, 출석 누적 분포, 충전 누적 분포
