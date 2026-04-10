-- ---------------------------------------------------------------------------
-- Migration: error_log table
-- 作用：收录运行时错误和失败的 API response。
--
-- 在 PolarDB / 本地 PG 上运行：
--   psql "$DATABASE_URL" -f migrations/2026-04-10-error-log.sql
--
-- 幂等：用 IF NOT EXISTS，可重复执行。
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS error_log (
    id BIGSERIAL PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    level TEXT NOT NULL DEFAULT 'error',
    source TEXT NOT NULL,
    route TEXT,
    message TEXT NOT NULL,
    stack TEXT,
    status_code INTEGER,
    user_id TEXT,
    org_id TEXT,
    request_id TEXT,
    environment TEXT,
    user_agent TEXT,
    context JSONB,
    resolved BOOLEAN DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_error_log_created_at ON error_log (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_error_log_level_source ON error_log (level, source);
CREATE INDEX IF NOT EXISTS idx_error_log_route ON error_log (route);
CREATE INDEX IF NOT EXISTS idx_error_log_unresolved ON error_log (created_at DESC) WHERE resolved = false;
