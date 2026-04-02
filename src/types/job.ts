export interface Job {
  id: string;
  created_at: Date;
  name: string;
  description: string;
  organization_id: string;
  user_id: string;
  status: "processing" | "completed";
}

export interface Interviewee {
  id: number;
  created_at: Date;
  job_id: string;
  name: string | null;
  company: string | null;
  position: string | null;
  summary: string | null;
  score: number;
  resume_url: string | null;
  original_filename: string | null;
  status: "pending" | "analyzed" | "error";
}
