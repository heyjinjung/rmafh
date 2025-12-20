# Vault v2.0 API 에러/예외 매핑

## 1. 메타
- 문서 타입: 에러/예외 매핑
- 버전: v0.2
- 작성일: 2025-12-20
- 대상: 백엔드 개발자

## 2. 공통 원칙
- 에러 코드는 API_SPEC_VAULT_V2.md의 코드 테이블을 최대한 따르되, **현재 구현은 FastAPI의 기본 `HTTPException(detail=...)`을 사용**합니다.
- 따라서 프런트/운영툴은 당분간 **`detail` 문자열을 에러 코드로 해석**합니다.
- (향후) 공통 미들웨어/에러 엔벨로프(`{error:{code,message}}`) 도입 시 본 문서를 업데이트합니다.

## 3. 현재 구현의 에러 응답 포맷
FastAPI 기본 포맷:
```json
{ "detail": "ERROR_CODE" }
```

## 4. 코드-HTTP 매핑(현재 구현 기준)

### 4.1 400 Bad Request (입력/검증)
- `INVALID_VAULT_TYPE`
- `INVALID_REQUEST_ID`
- `INVALID_CHANNEL`
- `INVALID_INVITE_CODE`
- `EMPTY_ROWS` / `TOO_MANY_ROWS` / `NO_VALID_ROWS`
- `EMPTY_EXTERNAL_USER_IDS`
- `USER_REQUIRED`
- `INVALID_SCOPE` / `INVALID_REASON` / `USER_IDS_REQUIRED` / `INVALID_EXTEND_HOURS`
- `INVALID_NOTIFY_TYPE` / `EMPTY_USER_IDS` / `VARIANT_NOT_FOUND`

### 4.2 403 Forbidden (조건 미충족)
- `NOT_CLAIMABLE`
- `EXTENSION_FORBIDDEN`

### 4.3 404 Not Found (대상 없음)
- `EXTERNAL_USER_NOT_FOUND`
- `EXTERNAL_USER_IDS_NOT_FOUND`
- `NOT_FOUND`

### 4.4 409 Conflict (중복/제한)
- `ALREADY_CLAIMED`
- `ALREADY_ATTENDED`
- `EXTENSION_LIMIT`

### 4.5 500 Internal Server Error
- `IDENTITY_BULK_RESOLVE_FAILED`

## 5. 엔드포인트별 메모(운영 기준)
### 5.1 /api/vault/notify
- 대상 해석: `user_ids`와 `external_user_ids`를 **합집합**으로 처리(중복 제거).
- Dedup: `dedup_key` 충돌 시 재삽입하지 않음(같은 날 동일 타입/variant는 1회).

### 5.2 /api/vault/extend-expiry
- 대상 해석: `scope=USER_IDS`에서 `user_ids`와 `external_user_ids`를 **합집합**으로 처리(중복 제거).
- `shadow=true`: DB 변경 없이 후보 수/샘플만 반환.
- 멱등성: `request_id` 기반 best-effort(운영 재시도 시 `updated=0` 반환 가능).

### 5.3 /api/vault/referral-revive
- `request_id`는 멱등키. 이미 처리된 경우 이전 결과를 그대로 반환.

## 6. 프레임워크별 예외 클래스 (FastAPI + Pydantic)
- `HTTPException(status_code, detail="ERROR_CODE")`
- Pydantic ValidationError: 현재는 FastAPI 기본 422 응답이 발생할 수 있음(추후 400 `INVALID_REQUEST_BODY`로 통일 권장)

## 7. 공통 핸들링 권장(향후)
- 순서: Validation → Biz 예외 → DB/외부 예외 → Fallback 500
- 로그: level=error, fields={code, http_status, path, user_id, req_id}
- Trace id: req_id를 응답 헤더로 반환하는 형태 권장

## 6. 서비스 계층 예외 사용 예
- raise CustomBizError("INVALID_STATE", "Vault not unlocked", 400)
- raise CustomBizError("EXPIRED", "Vault expired", 403)
- raise CustomBizError("ALREADY_CLAIMED", "Already claimed", 409)

## 7. 응답 예시 (오류)
```json
{
  "error": {
    "code": "INVALID_STATE",
    "message": "Platinum already claimed",
    "request_id": "req-123"
  }
}
```

## 8. 로깅 패턴
- 필수 필드: timestamp, level, code, http_status, path, method, user_id, req_id, latency_ms
- 선택 필드: vault_type, tx_id, expires_at, env
- 샘플 포맷: JSON line (logfmt도 허용)
