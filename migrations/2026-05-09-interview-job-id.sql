-- ---------------------------------------------------------------------------
-- Migration: interview.job_id
-- 作用：让 interview 关联到 screening 出来的 job，dashboard 才能按岗位分组、
--      面试详情页才能"同岗位结果合并"。
--
-- ON DELETE SET NULL：删除 job 时不级联删 interview，把关联清空即可，
-- 那条面试会自动归入 dashboard 的"其他"分组。
--
-- 在 PolarDB / 本地 PG 上运行：
--   psql "$DATABASE_URL" -f migrations/2026-05-09-interview-job-id.sql
--
-- 幂等：用 IF NOT EXISTS，可重复执行。
-- ---------------------------------------------------------------------------

ALTER TABLE interview
  ADD COLUMN IF NOT EXISTS job_id TEXT REFERENCES job(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_interview_job_id ON interview (job_id);
