# Vault v2.0 API 스펙 (초안)

## 1. 메타
- 문서 타입: API 스펙
- 버전: v0.2 (초안)
- 작성일: 2025-12-20
- 대상: 백엔드/프론트엔드 개발자
- 범위: 금고 상태 조회/수령, 출석, 입금 훅, 알림 트리거

## 2. 공통
- Base URL: /api
- Auth: (현재 로컬/데모 구현은 미적용, 기본 user_id=1)
- 응답 형식: application/json; charset=utf-8
- 타임존: 모든 시간은 ISO8601 UTC, FE는 로컬 변환
- 상태 값: LOCKED, UNLOCKED, CLAIMED, EXPIRED

### 2.1 구현 노트(Next.js trailingSlash)
- Next 설정이 `trailingSlash: true` 이므로 FE에서 `/api/vault/status/` 처럼 슬래시 포함 호출을 기본으로 합니다.

## 3. Validation 규칙 (요약)
- 공통 헤더: Authorization 필수(Bearer), Content-Type: application/json
- vault_type 값: GOLD | PLATINUM | DIAMOND 외 금지 → 400 INVALID_VAULT_TYPE
- 금액: amount는 정수(원), 0보다 커야 함 → 아니면 400 INVALID_AMOUNT
- 날짜: occurred_at ISO8601 UTC, 미래 시각 5분 초과시 400 INVALID_TIMESTAMP
- idempotency: tx_id는 per user 고유, 중복 시 409 DUPLICATE_TX
- 출석: 하루 1회, 서버 기준 일자 중복 시 409 DUPLICATE_ATTENDANCE
- 만료: expires_at 지난 후 상태 변경 요청은 403 EXPIRED
- 요청 상관관계: request_id(X-Request-Id) 헤더/바디는 멱등키, 중복 시 409 DUPLICATE_REQUEST
- 만료 연장: extend_hours는 1~72, reason은 OPS|PROMO|REFERRAL|ADMIN만 허용
- 알림 A/B: variant_id는 사전 등록된 값만 허용, 미등록 시 400 VARIANT_NOT_FOUND

## 4. 엔드포인트
### 4.1 GET /api/vault/status
- 설명: 금고 3종 상태, 진행률, 만료 타이머 조회
- Query: 없음
- Response 200
```json
{
	"gold_status": "UNLOCKED",
	"platinum_status": "LOCKED",
	"diamond_status": "LOCKED",
	"platinum_attendance_days": 1,
	"platinum_deposit_done": false,
	"diamond_deposit_current": 120000,
	"expires_at": "2025-12-26T00:00:00Z",
	"now": "2025-12-20T12:00:00Z",
	"loss_total": 130000,
	"loss_breakdown": {"GOLD": 10000, "PLATINUM": 30000, "DIAMOND": 100000, "BONUS": 0},
	"ms_countdown": {"enabled": true, "remaining_ms": 3578123},
	"referral_revive_available": true,
	"social_proof": {"vault_type": "PLATINUM", "claimed_last_24h": 4231},
	"curation_tier": "PLATINUM_BIASED"
}
```

### 4.2 POST /api/vault/claim
- 설명: 금고별 수령 처리 (골드/플래티넘/다이아)
- Body
```json
{ "vault_type": "GOLD" | "PLATINUM" | "DIAMOND" }
```
- Validation: vault_type 필수, 상태가 UNLOCKED일 때만 허용, 만료 시 거부
- Response 200
```json
{ "claimed": true, "vault_type": "GOLD", "now": "2025-12-20T12:00:00Z", "expires_at": "2025-12-26T00:00:00Z" }
```
- (추가 구현 예정) 외부 보상 지급 장애 시: 202 Accepted + compensation_queue_id 반환
- 에러: 400 (잘못된 상태), 409 (이미 수령), 404 (존재하지 않음)

#### 현재 구현(로컬/데모)
- 상태가 UNLOCKED가 아니면 403 `NOT_CLAIMABLE`
- 이미 수령이면 409 `ALREADY_CLAIMED`

### 4.3 POST /api/vault/attendance
- 설명: 일일 출석 체크, 플래티넘 진행률 반영 (일 1회)
- Body: 없음
- Validation: 당일 이미 체크된 경우 409, expires_at 경과 시 403
- Response 200
```json
{ "platinum_attendance_days": 2, "now": "2025-12-20T12:00:00Z", "expires_at": "2025-12-26T00:00:00Z" }
```
- 에러: 409 (중복 출석), 403 (기간 만료)

#### 현재 구현(로컬/데모)
- 당일 중복 출석이면 409 `ALREADY_ATTENDED`

### 4.4 POST /api/vault/deposit-hook
- 설명: 입금 웹훅/내부 콜백, 단일 50,000원/누적 500,000원 반영
- Body
```json
{ "user_id": 123, "amount": 70000, "tx_id": "abc", "occurred_at": "2025-12-20T11:00:00Z" }
```
- 처리 로직: 단일 50,000원 이상 → platinum_deposit_done=true, 누적 합산 → diamond_deposit_current 증가
- Validation: amount>0 정수, tx_id 필수/고유, occurred_at 필수·ISO8601, user 존재 필수
- Response 200
```json
{ "platinum_deposit_done": true, "diamond_deposit_current": 190000 }
```
- 에러: 409 (중복 tx_id), 404 (user 미존재)

#### 현재 상태
- 아직 미구현(문서 설계만 존재)

### 4.5 POST /api/vault/notify
- 설명: 알림 트리거(내부용). 소멸 경고/출석 부족 알림 발송
- Body
```json
{ "type": "EXPIRY_D2" | "ATTENDANCE_D2" | "TICKET_ZERO", "user_ids": [123,124], "variant_id": "A" }
```
- Validation: type 필수, user_ids 비어있으면 400, 최대 1000명 제한, variant_id는 사전 등록된 값만 허용, 내부 인증 필요
- Response 202: 비동기 큐 enqueue 결과

### 4.6 POST /api/vault/referral-revive
- 설명: 만료 D-1 사용자가 친구 초대/특정 액션 수행 시 expires_at을 +24h 연장 (1회 제한)
- Body
```json
{ "request_id": "req-123", "channel": "KAKAO" | "LINK", "invite_code": "abc123" }
```
- Validation: expires_at - now ∈ [24h, 48h], 이미 연장된 경우 409 EXTENSION_LIMIT, request_id 멱등
- Response 200
```json
{ "revived": true, "expires_at": "2025-12-27T00:00:00Z" }
```

### 4.7 POST /api/vault/extend-expiry (admin/ops)
- 설명: 운영/마케팅/점검 사유로 특정 사용자 또는 전체 활성 금고의 expires_at을 일괄/개별 연장
- Body
```json
{ "request_id": "req-ops-1", "scope": "ALL_ACTIVE" | "USER_IDS", "user_ids": [1,2], "extend_hours": 24, "reason": "OPS" | "PROMO" | "ADMIN", "shadow": true }
```
- Validation: extend_hours 1~72, scope/user_ids 일관성, shadow=true면 실제 업데이트 없이 대상/결과만 프리뷰
- Response
	- 200 (shadow=false): {"updated": 1200, "new_expires_at": "..."}
	- 200 (shadow=true): {"shadow": true, "candidates": 1400, "sample_user_ids": [1,2,3]}

## 5. 에러 포맷
```json
{ "error": { "code": "INVALID_STATE", "message": "Platinum already claimed" } }
```

## 6. 에러 코드 / 예외 매핑
| code | http | 설명 | 발생 위치 |
| --- | --- | --- | --- |
| INVALID_REQUEST_BODY | 400 | 요청 스키마/필드 검증 실패 | 전 엔드포인트 |
| UNAUTHORIZED | 401 | 인증 토큰 누락/만료 | 공통 미들웨어 |
| INVALID_VAULT_TYPE | 400 | 잘못된 vault_type | claim · notify |
| INVALID_AMOUNT | 400 | amount <= 0 또는 정수 아님 | deposit-hook |
| INVALID_TIMESTAMP | 400 | occurred_at 형식/미래 5분 초과 | deposit-hook |
| INVALID_STATE | 400 | 상태 전이 불가 (LOCKED→CLAIMED 등) | claim · attendance |
| DUPLICATE_ATTENDANCE | 409 | 동일 일자 출석 중복 | attendance |
| DUPLICATE_TX | 409 | tx_id 중복 | deposit-hook |
| DUPLICATE_REQUEST | 409 | request_id 재사용 | claim · referral-revive · extend-expiry |
| ALREADY_CLAIMED | 409 | 이미 수령 완료 | claim |
| EXTENSION_LIMIT | 409 | 허용 연장 횟수 초과 | referral-revive · extend-expiry |
| EXTENSION_FORBIDDEN | 403 | 만료/비대상 구간에서 연장 요청 | referral-revive |
| VARIANT_NOT_FOUND | 400 | 등록되지 않은 variant_id | notify |
| EXPIRED | 403 | 만료 후 요청 | claim · attendance |
| NOT_FOUND | 404 | user/vault 미존재 | status · claim · attendance |
| RATE_LIMITED | 429 | (옵션) 알림/훅 과다 호출 | notify |
| INTERNAL_ERROR | 500 | 서버 내부 오류 | 공통 |

### 참고
- 에러/예외 처리 상세: [docs/API_ERRORS_VAULT_V2.md](API_ERRORS_VAULT_V2.md)

## 7. 비즈니스 규칙 요약
- 금고 상태 전이: LOCKED → UNLOCKED → CLAIMED, 미달성 만료 시 EXPIRED
- 만료 기준: expires_at 이후 CLAIMED 아닌 것은 EXPIRED로 전환
- 출석: 00시 단위, 하루 1회 증가, 3회 달성 시 플래티넘 해금 조건 충족
- 수령: UNLOCKED 상태에서만 가능, 중복 수령 불가
- 중복 방지: tx_id idempotency, 출석 일별 락 처리
- 손실 시뮬레이터: loss_total은 UNLOCKED/LOCKED 미수령 금액 합계(완성 보너스 포함), EXPIRED/CLAIMED 제외
- 긴박 타이머: expires_at - now < 1h → ms_countdown.enabled=true, remaining_ms 제공
- 부활권: referral-revive는 만료 D-1 구간 1회 제한, 성공 시 expires_at +24h
- 운영 연장: extend-expiry는 shadow 모드(미적용 프리뷰) 지원, request_id 멱등
- 알림 A/B: variant_id로 템플릿 분기, 클릭/claim 전환율을 variant 단위로 측정
- 보상 재시도: claim 중 외부 지급 실패 시 compensation_queue로 이관, 멱등 보장

## 8. 추적/로그
- 이벤트: VAULT_UNLOCKED, VAULT_CLAIMED, VAULT_EXPIRED, ALERT_SENT, EXPIRY_EXTENDED, REFERRAL_REVIVED, COMPENSATION_ENQUEUED
- 메트릭: 단계별 이탈률, 출석 진행률, 충전 분포, 알림 전환율, variant별 claim 전환, compensation 재시도 성공률
