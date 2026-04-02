"use server";

import sql from "@/lib/db";

const createInterviewee = async (payload: {
  job_id: string;
  resume_url: string;
  original_filename: string;
  status: string;
}) => {
  try {
    const data = await sql`INSERT INTO interviewee ${sql(payload)} RETURNING id`;
    return data?.[0] ?? null;
  } catch (error) {
    console.log(error);
    return null;
  }
};

const getIntervieweesByJobId = async (jobId: string) => {
  try {
    const data = await sql`
      SELECT * FROM interviewee
      WHERE job_id = ${jobId}
      ORDER BY score DESC, created_at ASC
    `;
    return [...(data || [])];
  } catch (error) {
    console.log(error);
    return [];
  }
};

const getPendingIntervieweesByJobId = async (jobId: string) => {
  try {
    const data = await sql`
      SELECT * FROM interviewee
      WHERE job_id = ${jobId} AND status = 'pending'
      ORDER BY created_at ASC
    `;
    return [...(data || [])];
  } catch (error) {
    console.log(error);
    return [];
  }
};

const updateInterviewee = async (
  id: number,
  payload: {
    name?: string;
    company?: string;
    position?: string;
    summary?: string;
    score?: number;
    status?: string;
  },
) => {
  try {
    await sql`UPDATE interviewee SET ${sql(payload)} WHERE id = ${id}`;
    return null;
  } catch (error) {
    console.log(error);
    return { error };
  }
};

export {
  createInterviewee,
  getIntervieweesByJobId,
  getPendingIntervieweesByJobId,
  updateInterviewee,
};
