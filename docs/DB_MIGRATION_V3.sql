-- =============================================================================
-- Vault System v3.0 DB Migration
-- =============================================================================
-- Version: 3.0
-- Date: 2026-01-09
-- Description: 금고 조건 변경에 따른 스키마 마이그레이션
-- Documentation: docs/VAULT_SOT.md
-- =============================================================================

-- ⚠️ 실행 전 백업 필수!
-- pg_dump -h localhost -U postgres -d vault_db > backup_before_v3.sql

BEGIN;

-- =============================================================================
-- 1. 플래티넘 금고 관련 필드 변경
-- =============================================================================

-- 1.1 누적 입금액 필드 추가 (기존 platinum_deposit_done BOOLEAN → INT로 변경 개념)
ALTER TABLE vault_status 
ADD COLUMN IF NOT EXISTS platinum_deposit_total INT DEFAULT 0;

COMMENT ON COLUMN vault_status.platinum_deposit_total IS '플래티넘 누적 입금액 (목표: 200,000원)';

-- 1.2 입금 횟수 필드 추가
ALTER TABLE vault_status 
ADD COLUMN IF NOT EXISTS platinum_deposit_count INT DEFAULT 0;

COMMENT ON COLUMN vault_status.platinum_deposit_count IS '플래티넘 입금 횟수 (목표: 3회)';

-- 1.3 기존 데이터 마이그레이션 (platinum_deposit_done이 true면 최소 조건 충족으로 간주)
UPDATE vault_status 
SET platinum_deposit_total = 200000, platinum_deposit_count = 3
WHERE platinum_deposit_done = TRUE 
  AND (platinum_deposit_total IS NULL OR platinum_deposit_total = 0);

-- =============================================================================
-- 2. 다이아 금고 관련 필드 변경
-- =============================================================================

-- 2.1 필드명 변경 (diamond_deposit_current → diamond_deposit_total)
-- PostgreSQL에서는 RENAME 사용
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
SET diamond_expires_at = created_at + INTERVAL '5 days'
WHERE diamond_expires_at IS NULL;

-- =============================================================================
-- 3. 인덱스 추가
-- =============================================================================

-- 3.1 플래티넘 조건 검색용 인덱스
CREATE INDEX IF NOT EXISTS idx_vault_platinum_deposit 
ON vault_status (platinum_deposit_total, platinum_deposit_count)
WHERE platinum_status NOT IN ('CLAIMED', 'EXPIRED');

-- 3.2 다이아 조건 검색용 인덱스
CREATE INDEX IF NOT EXISTS idx_vault_diamond_conditions
ON vault_status (diamond_deposit_total, diamond_attendance_days)
WHERE diamond_status NOT IN ('CLAIMED', 'EXPIRED');

-- 3.3 다이아 만료시간 인덱스
CREATE INDEX IF NOT EXISTS idx_vault_diamond_expires
ON vault_status (diamond_expires_at)
WHERE diamond_status NOT IN ('CLAIMED', 'EXPIRED');

-- =============================================================================
-- 4. 뷰 생성 (분석용)
-- =============================================================================

CREATE OR REPLACE VIEW vault_progress_v3 AS
SELECT 
    user_id,
    -- 골드 상태
    gold_status,
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
    created_at
FROM vault_status;

COMMENT ON VIEW vault_progress_v3 IS 'Vault v3.0 진행률 분석용 뷰';

-- =============================================================================
-- 5. 마이그레이션 로그
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
    '{"version": "3.0", "changes": ["platinum_deposit_total", "platinum_deposit_count", "diamond_attendance_days", "diamond_expires_at"]}',
    '{"migration_date": "2026-01-09", "description": "Vault v3.0 schema migration"}'
);

COMMIT;

-- =============================================================================
-- 검증 쿼리
-- =============================================================================

-- 스키마 확인
-- SELECT column_name, data_type, column_default 
-- FROM information_schema.columns 
-- WHERE table_name = 'vault_status' 
-- ORDER BY ordinal_position;

-- 데이터 확인
-- SELECT * FROM vault_progress_v3 LIMIT 10;
