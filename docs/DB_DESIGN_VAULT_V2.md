# Vault v2.0 DB 설계

## 1. 메타
- 문서 타입: DB 설계
- 버전: v0.1 (초안)
- 작성일: 2025-12-20
- 대상: 백엔드/DBA

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
  - created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  - expires_at DATETIME NOT NULL

## 3. 인덱스 제안
- PK: (user_id)
- 보조: (expires_at), (platinum_status), (diamond_status)
- 유니크: user_id (단일 레코드 보장)

### 3.1 추가 인덱스/옵션
- (platinum_attendance_days) partial: WHERE platinum_status <> 'CLAIMED' (출석 대상 조회 최적화)
- (diamond_deposit_current) partial: WHERE diamond_status <> 'CLAIMED' (누적 충전 진행률 조회)
- (expires_at, gold_status, platinum_status, diamond_status) 복합: 만료 배치/알림 필터 최적화

## 4. 데이터 시드/초기화
- 신규 가입 시 vault_status 생성, expires_at = 가입 + 7일
- 초기 상태: 모두 LOCKED (FE 라벨은 "보관 중")

## 5. 파티셔닝/TTL 고려
- 파티셔닝: 활성+만료 분리 위해 expires_at 월 단위 파티션(혹은 RANGE) 고려. 활성 테이블은 작은 워킹셋 유지.
- TTL/아카이빙: expires_at 90일 지난 레코드는 archive 테이블로 이동하거나 청소 배치 수행 (규정/분석 요구에 따라 보존 기간 결정).
- 인덱스 유지: 오래된 파티션에 대한 인덱스 드랍/압축으로 비용 절감.

## 6. 운영 메모
- 만료 배치는 expires_at + 상태 != CLAIMED 조건으로 스캔하므로 만료 가까운 파티션 우선 처리
- idempotent 업데이트를 위해 상태 전이 시 WHERE 조건에 현재 상태 포함 (예: WHERE user_id=? AND platinum_status='LOCKED')

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
