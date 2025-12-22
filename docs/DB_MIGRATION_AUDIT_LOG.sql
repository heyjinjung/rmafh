-- 어드민 감사 로그 테이블 (Vault v2.0)

CREATE TABLE IF NOT EXISTS admin_audit_log (
  id BIGSERIAL PRIMARY KEY,
  
  -- 누가
  admin_user VARCHAR(128) NOT NULL,  -- 어드민 식별자 (IP, username 등)
  
  -- 언제
  performed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- 무엇을
  action VARCHAR(64) NOT NULL,  -- 액션 타입: USER_DAILY_IMPORT, EXTEND_EXPIRY, NOTIFY, REFERRAL_REVIVE, COMPENSATION_ENQUEUE
  endpoint VARCHAR(128) NOT NULL,  -- API 엔드포인트
  
  -- 대상/범위
  target_user_ids BIGINT[],  -- 영향받은 user_id들
  target_count INT NOT NULL DEFAULT 0,  -- 영향받은 사용자 수
  
  -- 요청 세부사항
  request_id VARCHAR(64),  -- idempotency key
  request_body JSONB,  -- 요청 body
  
  -- 결과
  response_status VARCHAR(16) NOT NULL DEFAULT 'SUCCESS',  -- SUCCESS, ERROR, PARTIAL
  response_summary JSONB,  -- 응답 요약 (처리 건수, 에러 등)
  error_message TEXT,  -- 에러 발생시 메시지
  
  -- 메타데이터
  metadata JSONB  -- 추가 컨텍스트 (shadow 여부, variant_id 등)
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_audit_performed_at ON admin_audit_log(performed_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_admin_user ON admin_audit_log(admin_user, performed_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_action ON admin_audit_log(action, performed_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_request_id ON admin_audit_log(request_id);
CREATE INDEX IF NOT EXISTS idx_audit_target_users ON admin_audit_log USING GIN(target_user_ids);

-- 코멘트
COMMENT ON TABLE admin_audit_log IS '어드민 작업 감사 로그: 누가/언제/무엇을 수행했는지 추적';
COMMENT ON COLUMN admin_audit_log.admin_user IS '어드민 식별자 (IP 주소, 사용자명 등)';
COMMENT ON COLUMN admin_audit_log.action IS '액션 타입 (USER_DAILY_IMPORT, EXTEND_EXPIRY, NOTIFY, REFERRAL_REVIVE, COMPENSATION_ENQUEUE)';
COMMENT ON COLUMN admin_audit_log.target_user_ids IS '영향받은 user_id 배열 (대량 작업시 샘플링 가능)';
COMMENT ON COLUMN admin_audit_log.request_body IS '원본 요청 body (JSON)';
COMMENT ON COLUMN admin_audit_log.response_summary IS '응답 요약 (inserted, updated, skipped, errors 등)';
