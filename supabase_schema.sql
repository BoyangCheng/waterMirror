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
    language TEXT DEFAULT 'zh'
);

-- Migration (run if table already exists):
-- ALTER TABLE interview ADD COLUMN IF NOT EXISTS language TEXT DEFAULT 'zh';

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
    tab_switch_count INTEGER
);

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

CREATE TABLE interviewee (
    id SERIAL PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    job_id TEXT REFERENCES job(id) ON DELETE CASCADE,
    name TEXT,
    company TEXT,
    position TEXT,
    summary TEXT,
    score INTEGER DEFAULT 0,
    resume_url TEXT,
    original_filename TEXT,
    status TEXT DEFAULT 'pending'
);
