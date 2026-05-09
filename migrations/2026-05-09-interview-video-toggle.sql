-- ---------------------------------------------------------------------------
-- Migration: interview.is_video_enabled
-- 作用：让面试创建者在创建时决定要不要录视频。
--      默认 true，老数据自然继承。
--
-- 在 PolarDB / 本地 PG 上运行：
--   psql "$DATABASE_URL" -f migrations/2026-05-09-interview-video-toggle.sql
--
-- 幂等：用 IF NOT EXISTS。
-- ---------------------------------------------------------------------------

ALTER TABLE interview
  ADD COLUMN IF NOT EXISTS is_video_enabled BOOLEAN DEFAULT true;

-- 老数据兜底：把 NULL 全部设为 true
UPDATE interview SET is_video_enabled = true WHERE is_video_enabled IS NULL;
