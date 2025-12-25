-- 알림 메시지 템플릿 테이블 추가 (notification_templates)

-- 1) 테이블 생성
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

CREATE INDEX IF NOT EXISTS idx_notification_templates_type ON notification_templates(type);
CREATE INDEX IF NOT EXISTS idx_notification_templates_enabled ON notification_templates(enabled);

-- 2) 메시지 템플릿 초기 데이터 삽입

-- EXPIRY_D2: 만료 2일 전 - 마지막 기회
INSERT INTO notification_templates (type, title, body, cta_text, icon_emoji, category, priority, enabled)
VALUES (
  'EXPIRY_D2',
  '만료 2일 전 - 마지막 기회!',
  '🔔 안녕하세요!

당신의 프리미엄 멤버십이 2일 후 만료됩니다.
지금 바로 갱신하고 계속해서 특별한 혜택을 누려보세요!

✨ 멤버십 갱신 시 제한 없는 접근권한 보장
💎 프리미엄 콘텐츠 무제한 이용

⏰ 서둘러주세요. 시간이 얼마 남지 않았습니다!',
  '지금 갱신하기',
  '🔔',
  'REMINDER',
  1,
  TRUE
) ON CONFLICT (type) DO UPDATE
SET title = EXCLUDED.title,
    body = EXCLUDED.body,
    cta_text = EXCLUDED.cta_text,
    icon_emoji = EXCLUDED.icon_emoji,
    category = EXCLUDED.category,
    priority = EXCLUDED.priority,
    enabled = EXCLUDED.enabled,
    updated_at = NOW();

-- EXPIRY_D0: 긴급 - 오늘 만료됨
INSERT INTO notification_templates (type, title, body, cta_text, icon_emoji, category, priority, enabled)
VALUES (
  'EXPIRY_D0',
  '긴급: 오늘 만료됩니다!',
  '⚠️ 긴급 알림!

당신의 프리미엄 멤버십이 오늘 만료됩니다.

지금 바로 갱신하지 않으면 
모든 프리미엄 기능에 접근할 수 없게 됩니다.

🚨 지금 바로 갱신하세요!',
  '지금 갱신하기',
  '⚠️',
  'URGENT',
  2,
  TRUE
) ON CONFLICT (type) DO UPDATE
SET title = EXCLUDED.title,
    body = EXCLUDED.body,
    cta_text = EXCLUDED.cta_text,
    icon_emoji = EXCLUDED.icon_emoji,
    category = EXCLUDED.category,
    priority = EXCLUDED.priority,
    enabled = EXCLUDED.enabled,
    updated_at = NOW();

-- ATTENDANCE_D2: 출석 미달 - 2일 기회
INSERT INTO notification_templates (type, title, body, cta_text, icon_emoji, category, priority, enabled)
VALUES (
  'ATTENDANCE_D2',
  '출석 기회를 놓치고 있어요!',
  '📅 출석 기회를 놓치고 있어요!

현재 출석 일수: [CURRENT_COUNT]일
목표 출석 일수: [TARGET_COUNT]일
남은 일수: 2일

지금이 마지막 기회입니다!
다음 2일 동안 출석하면 
추가 보상을 받을 수 있습니다.

✅ 지금 바로 출석 체크하기',
  '출석하기',
  '📅',
  'REMINDER',
  1,
  TRUE
) ON CONFLICT (type) DO UPDATE
SET title = EXCLUDED.title,
    body = EXCLUDED.body,
    cta_text = EXCLUDED.cta_text,
    icon_emoji = EXCLUDED.icon_emoji,
    category = EXCLUDED.category,
    priority = EXCLUDED.priority,
    enabled = EXCLUDED.enabled,
    updated_at = NOW();

-- TICKET_ZERO: 기회 소진 - 긴급 회원가입
INSERT INTO notification_templates (type, title, body, cta_text, icon_emoji, category, priority, enabled)
VALUES (
  'TICKET_ZERO',
  '기회 소진 - 새로운 시작!',
  '😢 더 이상의 기회가 없습니다.

당신의 모든 기회를 다 소진했습니다.

하지만 아직 희망은 있습니다!

🆕 새로운 프리미엄 멤버십으로
무제한 기회를 얻으세요!

💰 특별 할인가: 지금 가입하면 50% 할인!

⏰ 이 특가는 24시간만 유효합니다.
지금 바로 가입하세요!',
  '특가로 가입하기',
  '😢',
  'URGENT',
  2,
  TRUE
) ON CONFLICT (type) DO UPDATE
SET title = EXCLUDED.title,
    body = EXCLUDED.body,
    cta_text = EXCLUDED.cta_text,
    icon_emoji = EXCLUDED.icon_emoji,
    category = EXCLUDED.category,
    priority = EXCLUDED.priority,
    enabled = EXCLUDED.enabled,
    updated_at = NOW();

-- SOCIAL_PROOF: 사회적 증명 - 동기부여
INSERT INTO notification_templates (type, title, body, cta_text, icon_emoji, category, priority, enabled)
VALUES (
  'SOCIAL_PROOF',
  '당신도 이들처럼 성공할 수 있습니다!',
  '🌟 당신도 이들처럼 성공할 수 있습니다!

지금 활동 중인 프리미엄 회원들:
━━━━━━━━━━━━━━━━━━━━━━━━
📊 5,234명이 이번 달 목표를 달성했어요!
📈 평균 참여도: 87%
💰 평균 보상: 1,250,000원
━━━━━━━━━━━━━━━━━━━━━━━━

당신도 그들의 일원이 될 수 있습니다.

✨ 지금 시작하면 무엇이 다를까요?

→ 성공 사례 확인하기
→ 지금 바로 시작하기',
  '시작하기',
  '🌟',
  'SOCIAL_PROOF',
  0,
  TRUE
) ON CONFLICT (type) DO UPDATE
SET title = EXCLUDED.title,
    body = EXCLUDED.body,
    cta_text = EXCLUDED.cta_text,
    icon_emoji = EXCLUDED.icon_emoji,
    category = EXCLUDED.category,
    priority = EXCLUDED.priority,
    enabled = EXCLUDED.enabled,
    updated_at = NOW();

-- 확인 쿼리
SELECT type, title, category, priority FROM notification_templates ORDER BY priority DESC;
