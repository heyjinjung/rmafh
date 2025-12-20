-- Vault v2.0 DB migration (PostgreSQL dialect)
-- Run in a transaction per section where possible.

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
