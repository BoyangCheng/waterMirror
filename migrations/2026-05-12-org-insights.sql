-- ---------------------------------------------------------------------------
-- Migration: org_insights table
-- 作用：为 dashboard 顶部"动态条" ticker 存储按 org 维度生成的洞察文案。
--
-- 数据生成时机：lazy ——
--   用户进 dashboard → /api/org-insights → 检查 max(created_at) 是否 > 1h
--   是则后台 fire-and-forget 触发生成（删旧 + 插新），不阻塞用户响应
--
-- expires_at 控制不同类型 insight 的有效期：
--   - 实时活动（"刚刚完成"）：1h
--   - 月度统计：当月底
--   - 累计：1d
-- 前端只取 expires_at > NOW() 的记录。
--
-- 在 PolarDB / 本地 PG 上运行：
--   psql "$DATABASE_URL" -f migrations/2026-05-12-org-insights.sql
--
-- 幂等：用 IF NOT EXISTS，可重复执行。
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS org_insights (
    id BIGSERIAL PRIMARY KEY,
    organization_id TEXT REFERENCES organization(id),
    insight_type TEXT NOT NULL,        -- 'recent_completed' / 'high_score' / 'monthly_*' / etc
    text TEXT NOT NULL,                 -- 直接展示的完整文案（已 i18n localized）
    emoji TEXT,                         -- 单独存（前端可换 icon）
    sort_priority INTEGER DEFAULT 0,    -- 排序：高优先排前
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_org_insights_active
  ON org_insights (organization_id, expires_at);
CREATE INDEX IF NOT EXISTS idx_org_insights_expired
  ON org_insights (expires_at);
