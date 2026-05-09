export interface Question {
  id: string;
  question: string;
  follow_up_count: number;
}

export interface Quote {
  quote: string;
  call_id: string;
}

export interface InterviewBase {
  user_id: string;
  organization_id: string;
  name: string;
  interviewer_id: bigint;
  objective: string;
  question_count: number;
  time_duration: string;
  is_anonymous: boolean;
  questions: Question[];
  description: string;
  response_count: bigint;
  language: "zh" | "en";
  /** 通过"已添加职位简历"创建的面试会带上 job.id；手动创建的为 null，归到 dashboard 的"其他"分组。 */
  job_id?: string | null;
  /** 创建时是否开启录音录像。false → 候选人端不开摄像头、不跑 MediaRecorder。默认 true。 */
  is_video_enabled?: boolean;
}

export interface InterviewDetails {
  id: string;
  created_at: Date;
  url: string | null;
  insights: string[];
  quotes: Quote[];
  details: any;
  is_active: boolean;
  theme_color: string;
  logo_url: string;
  respondents: string[];
  readable_slug: string;
}

export interface Interview extends InterviewBase, InterviewDetails {}
