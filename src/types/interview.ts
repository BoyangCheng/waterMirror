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
  /** 由 getInterviewById 的 LEFT JOIN 带过来的面试官头像 URL，
   *  让候选人页面省一次 getInterviewer roundtrip。可能为 null（面试官被删/id 错）。 */
  interviewer_image?: string | null;
  /** 由 getInterviewById 的 LEFT JOIN 带过来的 org logo URL（organization.image_url）。
   *  这是候选人页 logo 的真实来源 —— 不再读 interview.logo_url 这个老字段。
   *  null 时前端 fallback 到 /watermirrorlogo.png。 */
  org_logo_url?: string | null;
}

export interface Interview extends InterviewBase, InterviewDetails {}
