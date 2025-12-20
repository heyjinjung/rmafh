# Vault v2.0 API 에러/예외 매핑

## 1. 메타
- 문서 타입: 에러/예외 매핑
- 버전: v0.2
- 작성일: 2025-12-20
- 대상: 백엔드 개발자

## 2. 공통 원칙
- 에러 코드는 API_SPEC_VAULT_V2.md의 코드 테이블과 동일하게 사용
- 예외 → 코드/HTTP 변환은 공통 미들웨어에서 처리, 비즈니스 예외는 서비스 계층에서 명시적으로 raise
- 메시지는 사용자 노출용/로그용을 분리 (user_message, debug_message)

## 3. 코드-HTTP 매핑
- UNAUTHORIZED → 401
- INVALID_VAULT_TYPE/INVALID_AMOUNT/INVALID_TIMESTAMP/INVALID_STATE → 400
- VARIANT_NOT_FOUND → 400
- DUPLICATE_ATTENDANCE/DUPLICATE_TX/ALREADY_CLAIMED → 409
- DUPLICATE_REQUEST → 409
- EXTENSION_LIMIT → 409
- EXPIRED → 403
- EXTENSION_FORBIDDEN → 403
- NOT_FOUND → 404
- RATE_LIMITED → 429
- INTERNAL_ERROR → 500

### 3.1 현재 구현에서 사용 중인 detail 코드(보강)
- 출석 중복: `ALREADY_ATTENDED` (409)
- 수령 불가(UNLOCKED 아님): `NOT_CLAIMABLE` (403)
- scope/user_ids 검증: `INVALID_SCOPE`(400), `USER_IDS_REQUIRED`(400), `INVALID_EXTEND_HOURS`(400)
- 알림 검증: `INVALID_NOTIFY_TYPE`(400), `EMPTY_USER_IDS`(400)

## 4. 프레임워크별 예외 클래스 (예: FastAPI + Pydantic)
- HTTPException(status_code, detail={code, message})
- ValidationError: 요청 스키마 불일치 → 400 INVALID_REQUEST_BODY
- CustomBizError(code, message, http_status) → 서비스 계층에서 raise
- DBIntegrityError(tx_id unique 등) → 409 DUPLICATE_TX로 변환

## 5. 공통 미들웨어/핸들러 패턴
- 순서: Validation → Biz 예외 → DB/외부 예외 → Fallback 500
- 로그: level=error, fields={code, http_status, path, user_id, req_id, vault_type, tx_id}
- Trace id: req_id를 응답 헤더(X-Request-Id)로 반환
- Idempotency: tx_id 중복 시 409, 원 응답 재사용 가능하게 설계

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
