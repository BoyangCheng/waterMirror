-- ---------------------------------------------------------------------------
-- Migration: response.video_url
-- 作用：存放浏览器端 MediaRecorder 录制后直传 OSS 的视频 URL。
--      录制走 VP9 / WebM / 0.2 Mbps，10 分钟约 16 MB。
--      不录到 / 上传失败时为 NULL，前端不展示视频播放器。
--
-- 在 PolarDB / 本地 PG 上运行：
--   psql "$DATABASE_URL" -f migrations/2026-05-09-response-video-url.sql
--
-- 幂等：用 IF NOT EXISTS，可重复执行。
-- ---------------------------------------------------------------------------

ALTER TABLE response
  ADD COLUMN IF NOT EXISTS video_url TEXT;
