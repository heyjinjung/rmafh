# 어드민 작업 감사 로그 운영 가이드

## 1. 개요

어드민 감사 로그 시스템은 모든 관리자 작업을 추적하여 **누가, 언제, 무엇을** 수행했는지 기록합니다.

### 1.1 로그 대상 작업

| 액션 | 엔드포인트 | 설명 |
|------|-----------|------|
| `USER_DAILY_IMPORT` | `/api/vault/user-daily-import` | 일일 CSV 업로드 (사용자 스냅샷/금고 상태 갱신) |
| `EXTEND_EXPIRY` | `/api/vault/extend-expiry` | 만료 시간 연장 (프로모션/운영) |
| `NOTIFY` | `/api/vault/notify` | 알림 발송 (A/B 테스트, 소셜 프루프 등) |
| `REFERRAL_REVIVE` | `/api/vault/referral-revive` | 추천 리바이브 (D-1 구간 24h 연장) |
| `COMPENSATION_ENQUEUE` | `/api/vault/compensation-enqueue` | 보상 큐 추가 (외부 서비스 연동) |

---

## 2. 로그 스키마

### 2.1 테이블: `admin_audit_log`

```sql
CREATE TABLE admin_audit_log (
  id BIGSERIAL PRIMARY KEY,
  
  -- 누가
  admin_user VARCHAR(128) NOT NULL,  -- 어드민 식별자 (IP 주소)
  
  -- 언제
  performed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- 무엇을
  action VARCHAR(64) NOT NULL,  -- 액션 타입
  endpoint VARCHAR(128) NOT NULL,  -- API 엔드포인트
  
  -- 대상/범위
  target_user_ids BIGINT[],  -- 영향받은 user_id들 (최대 1000개 샘플링)
  target_count INT NOT NULL DEFAULT 0,
  
  -- 요청 세부사항
  request_id VARCHAR(64),  -- idempotency key
  request_body JSONB,  -- 요청 본문
  
  -- 결과
  response_status VARCHAR(16) NOT NULL DEFAULT 'SUCCESS',  -- SUCCESS, ERROR, PARTIAL
  response_summary JSONB,  -- 응답 요약
  error_message TEXT,  -- 에러 메시지
  
  -- 메타데이터
  metadata JSONB
);
```

### 2.2 인덱스

- `idx_audit_performed_at`: 시간순 조회 최적화
- `idx_audit_admin_user`: 어드민별 조회
- `idx_audit_action`: 액션별 조회
- `idx_audit_request_id`: request_id 조회
- `idx_audit_target_users`: 특정 사용자 영향 추적 (GIN 인덱스)

---

## 3. 운영 가이드

### 3.1 로그 조회 쿼리

#### 최근 24시간 작업 내역

```sql
SELECT 
  performed_at, 
  admin_user, 
  action, 
  target_count,
  response_status
FROM admin_audit_log
WHERE performed_at >= NOW() - INTERVAL '24 hours'
ORDER BY performed_at DESC;
```

#### 특정 어드민 작업 이력

```sql
SELECT 
  performed_at,
  action,
  endpoint,
  target_count,
  response_summary
FROM admin_audit_log
WHERE admin_user = '192.168.1.100'
ORDER BY performed_at DESC
LIMIT 50;
```

#### 특정 사용자 영향 추적

```sql
SELECT 
  performed_at,
  admin_user,
  action,
  request_body,
  response_summary
FROM admin_audit_log
WHERE 12345 = ANY(target_user_ids)
ORDER BY performed_at DESC;
```

#### 에러 발생 작업 조회

```sql
SELECT 
  performed_at,
  admin_user,
  action,
  error_message
FROM admin_audit_log
WHERE response_status = 'ERROR'
ORDER BY performed_at DESC
LIMIT 20;
```

#### 대량 작업 모니터링

```sql
SELECT 
  performed_at,
  action,
  target_count,
  response_summary->>'updated' AS updated_count
FROM admin_audit_log
WHERE target_count > 100
ORDER BY performed_at DESC;
```

### 3.2 로그 보존 정책

**권장 보존 기간**:
- **Hot data (90일)**: 빠른 조회가 필요한 최근 로그
- **Warm data (1년)**: 압축 저장
- **Cold data (2년)**: 아카이브/삭제

#### 90일 이전 로그 아카이브

```sql
-- 1. 백업 테이블로 이동
CREATE TABLE admin_audit_log_archive (LIKE admin_audit_log INCLUDING ALL);

INSERT INTO admin_audit_log_archive
SELECT * FROM admin_audit_log
WHERE performed_at < NOW() - INTERVAL '90 days';

-- 2. 원본 테이블에서 삭제
DELETE FROM admin_audit_log
WHERE performed_at < NOW() - INTERVAL '90 days';
```

### 3.3 알림 설정 (선택)

**중요 이벤트 모니터링**:
- 대량 작업 (target_count > 500)
- 에러 발생 (response_status = 'ERROR')
- 특정 시간대 외 작업 (예: 새벽 2-6시)

```sql
-- 예: 최근 1시간 에러 발생 건수
SELECT COUNT(*) 
FROM admin_audit_log
WHERE response_status = 'ERROR'
  AND performed_at >= NOW() - INTERVAL '1 hour';
```

---

## 4. 보안 및 컴플라이언스

### 4.1 접근 제어

- **어드민 API**: `x-admin-password` 헤더 인증 (config.ADMIN_PASSWORD)
- **프로덕션 환경**: 반드시 환경 변수로 강력한 비밀번호 설정

```bash
export ADMIN_PASSWORD="강력한비밀번호123!"
```

### 4.2 감사 요구사항

- **GDPR/개인정보보호법**: 사용자 데이터 처리 이력 추적
- **내부 규정**: 관리자 작업 책임 추적 (누가/언제)

### 4.3 민감 정보 처리

- `request_body` 및 `response_summary`에 비밀번호, 토큰 등 저장 금지
- 필요시 마스킹 처리 (예: `external_user_id` → `ext_***45`)

---

## 5. 트러블슈팅

### 5.1 로그가 기록되지 않을 때

**원인**:
1. 인증 실패 (401 Unauthorized)
2. DB 연결 에러
3. `_log_admin_action` 함수 호출 누락

**해결**:
```sql
-- 최근 5분간 로그 확인
SELECT COUNT(*) FROM admin_audit_log
WHERE performed_at >= NOW() - INTERVAL '5 minutes';
```

### 5.2 성능 저하

**원인**: 로그 테이블 비대화

**해결**:
1. 오래된 로그 아카이브 (3.2 참고)
2. 인덱스 재구성
   ```sql
   REINDEX TABLE admin_audit_log;
   ```

### 5.3 샘플링으로 인한 누락

**배경**: `target_user_ids`는 최대 1000개만 저장 (성능 고려)

**대안**:
- `target_count`로 전체 대상 수 확인
- `request_body`에 원본 파라미터 저장 (필요시 복원)

---

## 6. 운영 체크리스트

- [ ] 주 1회: 에러 로그 확인
- [ ] 월 1회: 90일 이전 로그 아카이브
- [ ] 분기 1회: 로그 보존 정책 준수 검증
- [ ] 반기 1회: 어드민 비밀번호 변경
- [ ] 연 1회: 감사 로그 외부 백업

---

## 7. 예시 시나리오

### 7.1 시나리오: 대량 만료 연장 작업 추적

**상황**: 2024-12-25에 전체 사용자 72시간 연장

```sql
SELECT 
  performed_at,
  admin_user,
  request_body->>'scope' AS scope,
  request_body->>'extend_hours' AS hours,
  target_count,
  response_summary->>'updated' AS updated_count
FROM admin_audit_log
WHERE action = 'EXTEND_EXPIRY'
  AND performed_at::date = '2024-12-25'
ORDER BY performed_at DESC;
```

### 7.2 시나리오: 특정 사용자 작업 이력 조회

**상황**: user_id=12345에 대한 모든 관리자 작업 추적

```sql
SELECT 
  performed_at,
  admin_user,
  action,
  request_body,
  response_summary
FROM admin_audit_log
WHERE 12345 = ANY(target_user_ids)
ORDER BY performed_at;
```

---

## 8. API 응답 예시

### 8.1 성공 케이스

```json
{
  "total": 150,
  "processed": 148,
  "identity_created": 5,
  "vault_rows_updated": 148
}
```

**로그 기록**:
```json
{
  "admin_user": "192.168.1.50",
  "action": "USER_DAILY_IMPORT",
  "target_count": 148,
  "response_status": "SUCCESS",
  "response_summary": {
    "total": 150,
    "processed": 148,
    "identity_created": 5,
    "vault_rows_updated": 148
  }
}
```

### 8.2 에러 케이스 (향후 확장)

```json
{
  "detail": "INVALID_SCOPE"
}
```

**로그 기록** (향후 try-catch 추가시):
```json
{
  "admin_user": "192.168.1.50",
  "action": "EXTEND_EXPIRY",
  "response_status": "ERROR",
  "error_message": "INVALID_SCOPE"
}
```

---

## 9. 참고 문서

- [API 스펙](API_SPEC_VAULT_V2.md)
- [DB 설계](DB_DESIGN_VAULT_V2.md)
- [어드민 가이드](ADMIN_GUIDE_VAULT_V2.md)

---

**작성일**: 2024-01-XX  
**버전**: 1.0  
**담당자**: Backend Team
