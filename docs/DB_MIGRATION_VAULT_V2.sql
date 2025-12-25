-- Vault v2.0 DB migration (PostgreSQL dialect)
-- Run in a transaction per section where possible.

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

-- 2-1) notification_templates (메시지 템플릿)
CREATE TABLE IF NOT EXISTS notification_templates (
  id SERIAL PRIMARY KEY,
  type VARCHAR(32) NOT NULL UNIQUE,
  title VARCHAR(128) NOT NULL,
  body TEXT NOT NULL,
  cta_text VARCHAR(64),
  icon_emoji VARCHAR(2),
  category VARCHAR(32),
  priority INT DEFAULT 0,
  enabled BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notification_templates_type
  ON notification_templates(type);
CREATE INDEX IF NOT EXISTS idx_notification_templates_enabled
  ON notification_templates(enabled);

INSERT INTO notification_templates (type, title, body, cta_text, icon_emoji, category, priority, enabled)
VALUES
  ('EXPIRY_D2', '만료 2일 전 - 마지막 기회!', '🔔 안녕하세요!

당신의 프리미엄 멤버십이 2일 후 만료됩니다.
지금 바로 갱신하고 계속해서 특별한 혜택을 누려보세요!

✨ 멤버십 갱신 시 제한 없는 접근권한 보장
💎 프리미엄 콘텐츠 무제한 이용

⏰ 서둘러주세요. 시간이 얼마 남지 않았습니다!', '지금 갱신하기', '🔔', 'REMINDER', 1, TRUE),
  ('EXPIRY_D0', '긴급: 오늘 만료됩니다!', '⚠️ 긴급 알림!

당신의 프리미엄 멤버십이 오늘 만료됩니다.

지금 바로 갱신하지 않으면 
모든 프리미엄 기능에 접근할 수 없게 됩니다.

🚨 지금 바로 갱신하세요!', '지금 갱신하기', '⚠️', 'URGENT', 2, TRUE),
  ('ATTENDANCE_D2', '출석 기회를 놓치고 있어요!', '📅 출석 기회를 놓치고 있어요!

현재 출석 일수: [CURRENT_COUNT]일
목표 출석 일수: [TARGET_COUNT]일
남은 일수: 2일

지금이 마지막 기회입니다!
다음 2일 동안 출석하면 
추가 보상을 받을 수 있습니다.

✅ 지금 바로 출석 체크하기', '출석하기', '📅', 'REMINDER', 1, TRUE),
  ('TICKET_ZERO', '기회 소진 - 새로운 시작!', '😢 더 이상의 기회가 없습니다.

당신의 모든 기회를 다 소진했습니다.

하지만 아직 희망은 있습니다!

🆕 새로운 프리미엄 멤버십으로
무제한 기회를 얻으세요!

💰 특별 할인가: 지금 가입하면 50% 할인!

⏰ 이 특가는 24시간만 유효합니다.
지금 바로 가입하세요!', '특가로 가입하기', '😢', 'URGENT', 2, TRUE),
  ('SOCIAL_PROOF', '당신도 이들처럼 성공할 수 있습니다!', '🌟 당신도 이들처럼 성공할 수 있습니다!

지금 활동 중인 프리미엄 회원들:
━━━━━━━━━━━━━━━━━━━━━━━━
📊 5,234명이 이번 달 목표를 달성했어요!
📈 평균 참여도: 87%
💰 평균 보상: 1,250,000원
━━━━━━━━━━━━━━━━━━━━━━━━

당신도 그들의 일원이 될 수 있습니다.

✨ 지금 시작하면 무엇이 다를까요?

→ 성공 사례 확인하기
→ 지금 바로 시작하기', '시작하기', '🌟', 'SOCIAL_PROOF', 0, TRUE)
ON CONFLICT (type) DO NOTHING;

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
