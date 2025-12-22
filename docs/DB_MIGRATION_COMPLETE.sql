-- Vault v2.0 Complete DB Migration (PostgreSQL dialect)
-- Includes: Main tables + Admin audit log
-- Run in a transaction per section where possible.

-- ============================================
-- PART 1: Core Vault Tables (DB_MIGRATION_VAULT_V2.sql)
-- ============================================

-- A) user_identity (external_user_id -> internal user_id mapping)
CREATE TABLE IF NOT EXISTS user_identity (
  user_id BIGSERIAL PRIMARY KEY,
  external_user_id TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 0) Baseline vault_status (for fresh environments)
CREATE TABLE IF NOT EXISTS vault_status (
  user_id BIGINT PRIMARY KEY,
  expires_at TIMESTAMPTZ NOT NULL,
  gold_status VARCHAR(16) NOT NULL DEFAULT 'ACTIVE',
  platinum_status VARCHAR(16) NOT NULL DEFAULT 'ACTIVE',
  diamond_status VARCHAR(16) NOT NULL DEFAULT 'ACTIVE',
  expires_initial_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expiry_extend_count INT NOT NULL DEFAULT 0,
  last_extension_reason VARCHAR(32),
  last_extension_at TIMESTAMPTZ
);

-- 1) Extend vault_status
ALTER TABLE vault_status
  ADD COLUMN IF NOT EXISTS expires_initial_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS expiry_extend_count INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_extension_reason VARCHAR(32),
  ADD COLUMN IF NOT EXISTS last_extension_at TIMESTAMPTZ;

-- Backfill expires_initial_at to current expires_at if NULL
UPDATE vault_status
SET expires_initial_at = expires_at
WHERE expires_initial_at IS NULL;

-- 2) notifications_queue (A/B variants, social proof, referral revive)
CREATE TABLE IF NOT EXISTS notifications_queue (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL,
  type VARCHAR(32) NOT NULL,
  vault_type VARCHAR(16),
  variant_id VARCHAR(16),
  dedup_key VARCHAR(128) NOT NULL,
  payload JSONB NOT NULL,
  scheduled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status VARCHAR(16) NOT NULL DEFAULT 'PENDING',
  retry_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_notifications_dedup
  ON notifications_queue(dedup_key);
CREATE INDEX IF NOT EXISTS idx_notifications_type_scheduled
  ON notifications_queue(type, scheduled_at);
CREATE INDEX IF NOT EXISTS idx_notifications_variant_type
  ON notifications_queue(variant_id, type);

-- 3) compensation_queue (idempotent reward retries)
CREATE TABLE IF NOT EXISTS compensation_queue (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL,
  vault_type VARCHAR(16) NOT NULL,
  request_id VARCHAR(64) NOT NULL,
  external_service VARCHAR(64) NOT NULL,
  payload JSONB NOT NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'PENDING',
  retry_count INT NOT NULL DEFAULT 0,
  next_retry_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_comp_request_service
  ON compensation_queue(request_id, external_service);
CREATE INDEX IF NOT EXISTS idx_comp_status_next_retry
  ON compensation_queue(status, next_retry_at);

-- 4) vault_expiry_extension_log (audit + shadow preview)
CREATE TABLE IF NOT EXISTS vault_expiry_extension_log (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL,
  prev_expires_at TIMESTAMPTZ NOT NULL,
  new_expires_at TIMESTAMPTZ NOT NULL,
  reason VARCHAR(16) NOT NULL,
  request_id VARCHAR(64) NOT NULL,
  shadow BOOLEAN NOT NULL DEFAULT FALSE,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_extension_request_id
  ON vault_expiry_extension_log(request_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_extension_user_referral_once
  ON vault_expiry_extension_log(user_id)
  WHERE reason = 'REFERRAL';
CREATE INDEX IF NOT EXISTS idx_extension_user_created
  ON vault_expiry_extension_log(user_id, created_at DESC);

-- 5) Constraints / enums (optional, adjust to your enum implementation)
-- If enums are used, ensure values cover: type = EXPIRY_D2, EXPIRY_D0, ATTENDANCE_D2, TICKET_ZERO, SOCIAL_PROOF, REFERRAL_REVIVE
-- status = PENDING, SENT, FAILED, DLQ | PENDING, RETRYING, DONE, FAILED for compensation
-- vault_type = GOLD, PLATINUM, DIAMOND

-- 6) Seed defaults for new columns
UPDATE vault_status
SET expiry_extend_count = 0,
    last_extension_reason = NULL,
    last_extension_at = NULL
WHERE expiry_extend_count IS NULL;

-- 7) (Optional) TTL/archive policies should be set separately for compensation_queue and notifications_queue.

-- B) user_admin_snapshot (Replaces user_snapshots in prior designs - simplified snapshot for admin operations)
CREATE TABLE IF NOT EXISTS user_admin_snapshot (
  user_id BIGINT PRIMARY KEY,
  external_user_id TEXT NOT NULL,
  nickname TEXT,
  deposit_total BIGINT NOT NULL DEFAULT 0,
  telegram_ok BOOLEAN NOT NULL DEFAULT FALSE,
  review_ok BOOLEAN NOT NULL DEFAULT FALSE,
  joined_at TIMESTAMPTZ,
  last_deposit_at TIMESTAMPTZ,
  last_updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_admin_external_user_id
  ON user_admin_snapshot(external_user_id);

-- ============================================
-- PART 2: Admin Audit Log (DB_MIGRATION_AUDIT_LOG.sql)
-- ============================================

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

-- ============================================
-- Migration Complete
-- ============================================
