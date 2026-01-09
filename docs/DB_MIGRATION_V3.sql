-- =============================================================================
-- Vault System v3.0 DB Migration (Fixed Final)
-- =============================================================================
-- Version: 3.0.2
-- Date: 2026-01-09
-- Description: 금고 조건 변경 + 골드 미션 + 감사로그 테이블 생성 + 컬럼 누락 방지
-- =============================================================================

BEGIN;

-- =============================================================================
-- 0. 사전 준비 (감사로그 테이블 생성)
-- =============================================================================
CREATE TABLE IF NOT EXISTS admin_audit_log (
    id BIGSERIAL PRIMARY KEY,
    admin_user VARCHAR(64) NOT NULL,
    action VARCHAR(64) NOT NULL,
    endpoint VARCHAR(255),
    target_count INT DEFAULT 0,
    response_status VARCHAR(64),
    response_summary JSONB,
    metadata JSONB,
    request_id VARCHAR(64),
    idempotency_key VARCHAR(128),
    job_id VARCHAR(64),
    target_user_ids JSONB,
    request_body JSONB,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_created_at ON admin_audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_action ON admin_audit_log(action);
CREATE INDEX IF NOT EXISTS idx_audit_request_id ON admin_audit_log(request_id);

-- =============================================================================
-- 1. 플래티넘 금고 관련 필드 변경
-- =============================================================================

-- 1.1 누적 입금액 필드 추가
ALTER TABLE vault_status 
ADD COLUMN IF NOT EXISTS platinum_deposit_total INT DEFAULT 0;

COMMENT ON COLUMN vault_status.platinum_deposit_total IS '플래티넘 누적 입금액 (목표: 200,000원)';

-- 1.2 입금 횟수 필드 추가
ALTER TABLE vault_status 
ADD COLUMN IF NOT EXISTS platinum_deposit_count INT DEFAULT 0;

COMMENT ON COLUMN vault_status.platinum_deposit_count IS '플래티넘 입금 횟수 (목표: 3회)';

-- 1.3 기존 데이터 마이그레이션 (안전하게 처리)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='vault_status' AND column_name='platinum_deposit_done') THEN
        EXECUTE 'UPDATE vault_status SET platinum_deposit_total = 200000, platinum_deposit_count = 3 WHERE platinum_deposit_done = TRUE AND (platinum_deposit_total IS NULL OR platinum_deposit_total = 0)';
    END IF;
END $$;

-- =============================================================================
-- 2. 다이아 금고 관련 필드 변경
-- =============================================================================

-- 2.1 필드명 변경 (diamond_deposit_current → diamond_deposit_total)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'vault_status' AND column_name = 'diamond_deposit_current'
    ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'vault_status' AND column_name = 'diamond_deposit_total'
    ) THEN
        ALTER TABLE vault_status RENAME COLUMN diamond_deposit_current TO diamond_deposit_total;
    END IF;
END $$;

-- 2.1.1 (Fallback) 다이아 누적 충전액 필드가 없으면 생성 (RENAME 실패 시 대비)
ALTER TABLE vault_status 
ADD COLUMN IF NOT EXISTS diamond_deposit_total INT DEFAULT 0;

COMMENT ON COLUMN vault_status.diamond_deposit_total IS '다이아 누적 충전액 (목표: 2,000,000원)';

-- 2.2 다이아 출석 횟수 필드 추가
ALTER TABLE vault_status 
ADD COLUMN IF NOT EXISTS diamond_attendance_days INT DEFAULT 0;

COMMENT ON COLUMN vault_status.diamond_attendance_days IS '다이아 출석 횟수 (목표: 2회)';

-- 2.3 다이아 별도 만료시간 필드 추가 (골드/플래티넘과 다름: 5일)
ALTER TABLE vault_status 
ADD COLUMN IF NOT EXISTS diamond_expires_at TIMESTAMPTZ;

COMMENT ON COLUMN vault_status.diamond_expires_at IS '다이아 금고 별도 만료시간 (가입 후 5일)';

-- 2.4 기존 사용자에 대한 다이아 만료시간 설정 (가입일 + 5일)
UPDATE vault_status 
SET diamond_expires_at = expires_initial_at + INTERVAL '5 days'
WHERE diamond_expires_at IS NULL;

-- =============================================================================
-- 3. 골드 미션 O/X 필드 추가
-- =============================================================================

ALTER TABLE vault_status 
ADD COLUMN IF NOT EXISTS gold_mission_1_done BOOLEAN NOT NULL DEFAULT FALSE;
COMMENT ON COLUMN vault_status.gold_mission_1_done IS '골드 미션 1 완료 여부';

ALTER TABLE vault_status 
ADD COLUMN IF NOT EXISTS gold_mission_2_done BOOLEAN NOT NULL DEFAULT FALSE;
COMMENT ON COLUMN vault_status.gold_mission_2_done IS '골드 미션 2 완료 여부';

ALTER TABLE vault_status 
ADD COLUMN IF NOT EXISTS gold_mission_3_done BOOLEAN NOT NULL DEFAULT FALSE;
COMMENT ON COLUMN vault_status.gold_mission_3_done IS '골드 미션 3 완료 여부';

-- =============================================================================
-- 3.1 플래티넘 미션 O/X 필드 추가
-- =============================================================================

ALTER TABLE vault_status 
ADD COLUMN IF NOT EXISTS platinum_mission_1_done BOOLEAN NOT NULL DEFAULT FALSE;
COMMENT ON COLUMN vault_status.platinum_mission_1_done IS '플래티넘 미션 1 완료 (누적 입금 20만원)';

ALTER TABLE vault_status 
ADD COLUMN IF NOT EXISTS platinum_mission_2_done BOOLEAN NOT NULL DEFAULT FALSE;
COMMENT ON COLUMN vault_status.platinum_mission_2_done IS '플래티넘 미션 2 완료 (입금 3회)';

ALTER TABLE vault_status 
ADD COLUMN IF NOT EXISTS platinum_mission_3_done BOOLEAN NOT NULL DEFAULT FALSE;
COMMENT ON COLUMN vault_status.platinum_mission_3_done IS '플래티넘 미션 3 완료 (출석 3일)';

ALTER TABLE vault_status 
ADD COLUMN IF NOT EXISTS platinum_mission_4_done BOOLEAN NOT NULL DEFAULT FALSE;
COMMENT ON COLUMN vault_status.platinum_mission_4_done IS '플래티넘 미션 4 완료 (리뷰)';

-- =============================================================================
-- 3.2 다이아 미션 O/X 필드 추가
-- =============================================================================

ALTER TABLE vault_status 
ADD COLUMN IF NOT EXISTS diamond_mission_1_done BOOLEAN NOT NULL DEFAULT FALSE;
COMMENT ON COLUMN vault_status.diamond_mission_1_done IS '다이아 미션 1 완료 (누적 200만원)';

ALTER TABLE vault_status 
ADD COLUMN IF NOT EXISTS diamond_mission_2_done BOOLEAN NOT NULL DEFAULT FALSE;
COMMENT ON COLUMN vault_status.diamond_mission_2_done IS '다이아 미션 2 완료 (출석 2회)';

-- =============================================================================
-- 4. 인덱스 추가
-- =============================================================================

-- 4.1 플래티넘 조건 검색용 인덱스
CREATE INDEX IF NOT EXISTS idx_vault_platinum_deposit 
ON vault_status (platinum_deposit_total, platinum_deposit_count)
WHERE platinum_status NOT IN ('CLAIMED', 'EXPIRED');

-- 4.2 다이아 조건 검색용 인덱스
CREATE INDEX IF NOT EXISTS idx_vault_diamond_conditions
ON vault_status (diamond_deposit_total, diamond_attendance_days)
WHERE diamond_status NOT IN ('CLAIMED', 'EXPIRED');

-- 4.3 다이아 만료시간 인덱스
CREATE INDEX IF NOT EXISTS idx_vault_diamond_expires
ON vault_status (diamond_expires_at)
WHERE diamond_status NOT IN ('CLAIMED', 'EXPIRED');

-- =============================================================================
-- 5. 뷰 생성 (분석용)
-- =============================================================================

CREATE OR REPLACE VIEW vault_progress_v3 AS
SELECT 
    user_id,
    -- 골드 상태
    gold_status,
    gold_mission_1_done,
    gold_mission_2_done,
    gold_mission_3_done,
    -- 플래티넘 진행률
    platinum_status,
    platinum_deposit_total,
    platinum_deposit_count,
    ROUND((platinum_deposit_total::numeric / 200000) * 100, 1) AS platinum_deposit_pct,
    (platinum_deposit_count >= 3 AND platinum_deposit_total >= 200000 AND gold_status = 'CLAIMED') AS platinum_conditions_met,
    -- 다이아 진행률
    diamond_status,
    COALESCE(diamond_deposit_total, 0) AS diamond_deposit_total,
    diamond_attendance_days,
    ROUND((COALESCE(diamond_deposit_total, 0)::numeric / 2000000) * 100, 1) AS diamond_deposit_pct,
    (COALESCE(diamond_deposit_total, 0) >= 2000000 AND diamond_attendance_days >= 2 AND platinum_status = 'CLAIMED') AS diamond_conditions_met,
    -- 만료시간
    expires_at,
    diamond_expires_at,
    -- 메타
    expires_initial_at AS created_at
FROM vault_status;

COMMENT ON VIEW vault_progress_v3 IS 'Vault v3.0 진행률 분석용 뷰';

-- =============================================================================
-- 6. 마이그레이션 로그
-- =============================================================================

INSERT INTO admin_audit_log (
    admin_user,
    action,
    endpoint,
    target_count,
    response_status,
    response_summary,
    metadata
) VALUES (
    'SYSTEM_MIGRATION',
    'DB_MIGRATION_V3',
    'DB_SCHEMA',
    0,
    'SUCCESS',
    '{"version": "3.0.2", "changes": ["platinum_deposit_total", "platinum_deposit_count", "diamond_attendance_days", "diamond_expires_at", "gold_mission_1_done", "gold_mission_2_done", "gold_mission_3_done", "admin_audit_log"]}',
    '{"migration_date": "2026-01-09", "description": "Vault v3.0 schema migration (Fixed Final)"}'
);

COMMIT;
