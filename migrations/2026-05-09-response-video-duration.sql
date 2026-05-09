-- ---------------------------------------------------------------------------
-- Migration: response.video_duration_ms
-- 作用：MediaRecorder + OSS append 流式上传出来的 WebM 缺末尾 SeekHead 元数据，
--      浏览器无法准确报告 video.duration（一直在变 / NaN / Infinity）。
--      录像时前端用 wall-clock 算真实长度，存到这里，播放器渲染进度条用 DB 值。
--
-- 跑：psql "$DATABASE_URL" -f migrations/2026-05-09-response-video-duration.sql
-- 幂等。
-- ---------------------------------------------------------------------------

ALTER TABLE response
  ADD COLUMN IF NOT EXISTS video_duration_ms INTEGER;
