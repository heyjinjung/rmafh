# Vault v2.0 API 스펙 (초안)

## 1. 메타
- 문서 타입: API 스펙
- 버전: v0.1 (초안)
- 작성일: 2025-12-20
- 대상: 백엔드/프론트엔드 개발자
- 범위: 금고 상태 조회/수령, 출석, 입금 훅, 알림 트리거

## 2. 공통
- Base URL: /api
- Auth: JWT (Authorization: Bearer <token>)
- 응답 형식: application/json; charset=utf-8
- 타임존: 모든 시간은 ISO8601 UTC, FE는 로컬 변환
- 상태 값: LOCKED, UNLOCKED, CLAIMED, EXPIRED

## 3. Validation 규칙 (요약)
- 공통 헤더: Authorization 필수(Bearer), Content-Type: application/json
- vault_type 값: GOLD | PLATINUM | DIAMOND 외 금지 → 400 INVALID_VAULT_TYPE
- 금액: amount는 정수(원), 0보다 커야 함 → 아니면 400 INVALID_AMOUNT
- 날짜: occurred_at ISO8601 UTC, 미래 시각 5분 초과시 400 INVALID_TIMESTAMP
- idempotency: tx_id는 per user 고유, 중복 시 409 DUPLICATE_TX
- 출석: 하루 1회, 서버 기준 일자 중복 시 409 DUPLICATE_ATTENDANCE
- 만료: expires_at 지난 후 상태 변경 요청은 403 EXPIRED

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
	"now": "2025-12-20T12:00:00Z"
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
{ "claimed": true, "vault_type": "GOLD", "new_balance": 10000 }
```
- 에러: 400 (잘못된 상태), 409 (이미 수령), 404 (존재하지 않음)

### 4.3 POST /api/vault/attendance
- 설명: 일일 출석 체크, 플래티넘 진행률 반영 (일 1회)
- Body: 없음
- Validation: 당일 이미 체크된 경우 409, expires_at 경과 시 403
- Response 200
```json
{ "platinum_attendance_days": 2, "platinum_status": "LOCKED" }
```
- 에러: 409 (중복 출석), 403 (기간 만료)

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

### 4.5 POST /api/vault/notify
- 설명: 알림 트리거(내부용). 소멸 경고/출석 부족 알림 발송
- Body
```json
{ "type": "EXPIRY_D2" | "ATTENDANCE_D2" | "TICKET_ZERO", "user_ids": [123,124] }
```
- Validation: type 필수, user_ids 비어있으면 400, 최대 1000명 제한, 내부 인증 필요
- Response 202: 비동기 큐 enqueue 결과

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
| ALREADY_CLAIMED | 409 | 이미 수령 완료 | claim |
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

## 8. 추적/로그
- 이벤트: VAULT_UNLOCKED, VAULT_CLAIMED, VAULT_EXPIRED, ALERT_SENT
- 메트릭: 단계별 이탈률, 출석 진행률, 충전 분포, 알림 전환율
