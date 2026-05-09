-- Create enum type for plan
CREATE TYPE plan AS ENUM ('free', 'pro', 'free_trial_over');

-- Create tables
CREATE TABLE organization (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    name TEXT,
    image_url TEXT,
    allowed_responses_count INTEGER,
    plan plan
);

CREATE TABLE "user" (
    id TEXT PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    email TEXT,
    name TEXT,
    phone TEXT,
    organization_id TEXT REFERENCES organization(id)
);

-- Migration (run if table already exists):
-- ALTER TABLE "user" ADD COLUMN IF NOT EXISTS name TEXT;
-- ALTER TABLE "user" ADD COLUMN IF NOT EXISTS phone TEXT;

CREATE TABLE interviewer (
    id SERIAL PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    agent_id TEXT,
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    image TEXT NOT NULL,
    audio TEXT,
    empathy INTEGER NOT NULL,
    exploration INTEGER NOT NULL,
    rapport INTEGER NOT NULL,
    speed INTEGER NOT NULL
);

CREATE TABLE interview (
    id TEXT PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    name TEXT,
    description TEXT,
    objective TEXT,
    organization_id TEXT REFERENCES organization(id),
    user_id TEXT REFERENCES "user"(id),
    interviewer_id INTEGER REFERENCES interviewer(id),
    is_active BOOLEAN DEFAULT true,
    is_anonymous BOOLEAN DEFAULT false,
    is_archived BOOLEAN DEFAULT false,
    logo_url TEXT,
    theme_color TEXT,
    url TEXT,
    readable_slug TEXT,
    questions JSONB,
    quotes JSONB[],
    insights TEXT[],
    respondents TEXT[],
    question_count INTEGER,
    response_count INTEGER,
    time_duration TEXT,
    language TEXT DEFAULT 'zh',
    -- 关联到 screening 的 job（"已添加职位简历"创建的面试），手动创建为 NULL
    -- 注意：FK 约束放到 job 表声明之后通过 ALTER 加，避免 schema 顺序依赖
    job_id TEXT,
    -- 创建面试时的"是否开启录像"开关；false → 候选人端不开摄像头、不跑 MediaRecorder
    is_video_enabled BOOLEAN DEFAULT true
);

CREATE INDEX IF NOT EXISTS idx_interview_job_id ON interview (job_id);

-- Migration (run if table already exists):
-- ALTER TABLE interview ADD COLUMN IF NOT EXISTS language TEXT DEFAULT 'zh';
-- ALTER TABLE interview ADD COLUMN IF NOT EXISTS job_id TEXT REFERENCES job(id) ON DELETE SET NULL;
-- CREATE INDEX IF NOT EXISTS idx_interview_job_id ON interview (job_id);
-- ALTER TABLE interview ADD COLUMN IF NOT EXISTS is_video_enabled BOOLEAN DEFAULT true;
-- UPDATE interview SET is_video_enabled = true WHERE is_video_enabled IS NULL;

CREATE TABLE response (
    id SERIAL PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    interview_id TEXT REFERENCES interview(id),
    name TEXT,
    email TEXT,
    call_id TEXT,
    candidate_status TEXT,
    duration INTEGER,
    details JSONB,
    analytics JSONB,
    is_analysed BOOLEAN DEFAULT false,
    is_ended BOOLEAN DEFAULT false,
    is_viewed BOOLEAN DEFAULT false,
    tab_switch_count INTEGER,
    -- 浏览器端 MediaRecorder 录的面试视频（VP9 WebM），存自有 OSS。null = 没录到/上传失败
    video_url TEXT,
    -- 录像真实时长（ms），前端用 wall-clock 算。WebM 流式 append 缺尾部 SeekHead 元数据，
    -- 浏览器自报 video.duration 不可靠（NaN/Infinity/动态变化）→ 播放器进度条用这个值
    video_duration_ms INTEGER
);

-- Migration (run if table already exists):
-- ALTER TABLE response ADD COLUMN IF NOT EXISTS video_url TEXT;
-- ALTER TABLE response ADD COLUMN IF NOT EXISTS video_duration_ms INTEGER;

CREATE TABLE feedback (
    id SERIAL PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    interview_id TEXT REFERENCES interview(id),
    email TEXT,
    feedback TEXT,
    satisfaction INTEGER
);

-- Resume Screening tables
CREATE TABLE job (
    id TEXT PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    organization_id TEXT REFERENCES organization(id),
    user_id TEXT REFERENCES "user"(id),
    status TEXT DEFAULT 'processing'
);

-- 现在 job 已经存在，把 interview.job_id 的 FK 约束加上
-- ON DELETE SET NULL：删 job 不级联删面试，关联清空 → dashboard 自动归到"其他"
ALTER TABLE interview
  ADD CONSTRAINT interview_job_id_fkey
  FOREIGN KEY (job_id) REFERENCES job(id) ON DELETE SET NULL;

CREATE TABLE interviewee (
    id SERIAL PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    job_id TEXT REFERENCES job(id) ON DELETE CASCADE,
    name TEXT,
    company TEXT,
    position TEXT,
    -- 候选人电话（AI 从简历里抽出来）
    phone TEXT,
    summary TEXT,
    score INTEGER DEFAULT 0,
    resume_url TEXT,
    -- 简历原文（pdf-parse 抽出来的纯文本，前端创建面试时拼进 objective 给 AI 做追问参考）
    resume_text TEXT,
    original_filename TEXT,
    status TEXT DEFAULT 'pending'
);

-- Migration (run if table already exists):
-- ALTER TABLE interviewee ADD COLUMN IF NOT EXISTS phone TEXT;
-- ALTER TABLE interviewee ADD COLUMN IF NOT EXISTS resume_text TEXT;

-- ---------------------------------------------------------------------------
-- error_log：运行时错误与失败 response 的持久化。
-- 通过 src/lib/error-log.ts 的 recordError() 插入；API 路由可用 withErrorLogging() 包一层。
-- 所有写入都是 fire-and-forget，失败只会走 console.error，不会阻塞主请求。
-- ---------------------------------------------------------------------------
CREATE TABLE error_log (
    id BIGSERIAL PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    level TEXT NOT NULL DEFAULT 'error',    -- 'error' | 'warn' | 'fatal'
    source TEXT NOT NULL,                   -- 'api' | 'client' | 'service' | 'background'
    route TEXT,                             -- e.g. '/api/screening/create-job' or 'call:timer'
    message TEXT NOT NULL,
    stack TEXT,
    status_code INTEGER,
    user_id TEXT,
    org_id TEXT,
    request_id TEXT,
    environment TEXT,                       -- 'development' | 'production'
    user_agent TEXT,
    context JSONB,                          -- 任意附加字段（request body 摘要、headers 等）
    resolved BOOLEAN DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_error_log_created_at ON error_log (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_error_log_level_source ON error_log (level, source);
CREATE INDEX IF NOT EXISTS idx_error_log_route ON error_log (route);
CREATE INDEX IF NOT EXISTS idx_error_log_unresolved ON error_log (created_at DESC) WHERE resolved = false;
