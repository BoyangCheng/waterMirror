"use server";

import sql, { cachedQuery, invalidateCache } from "@/lib/db";

const INTERVIEWEES_TTL = 15_000; // 15 秒（AI 处理中频繁更新）

const createInterviewee = async (payload: {
  job_id: string;
  resume_url: string;
  original_filename: string;
  status: string;
}) => {
  try {
    const data = await sql`INSERT INTO interviewee ${sql(payload)} RETURNING id`;
    invalidateCache(`interviewees:${payload.job_id}`);
    return data?.[0] ?? null;
  } catch (error) {
    console.log(error);
    return null;
  }
};

const getIntervieweesByJobId = async (jobId: string) => {
  try {
    return await cachedQuery(
      `interviewees:${jobId}`,
      async () => {
        const data = await sql`
          SELECT * FROM interviewee
          WHERE job_id = ${jobId}
          ORDER BY score DESC, created_at ASC
        `;
        return [...(data || [])];
      },
      INTERVIEWEES_TTL,
    );
  } catch (error) {
    console.log(error);
    return [];
  }
};

const getPendingIntervieweesByJobId = async (jobId: string) => {
  try {
    return await cachedQuery(
      `interviewees:pending:${jobId}`,
      async () => {
        const data = await sql`
          SELECT * FROM interviewee
          WHERE job_id = ${jobId} AND status = 'pending'
          ORDER BY created_at ASC
        `;
        return [...(data || [])];
      },
      INTERVIEWEES_TTL,
    );
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
    phone?: string | null;
    summary?: string;
    score?: number;
    status?: string;
  },
) => {
  try {
    await sql`UPDATE interviewee SET ${sql(payload)} WHERE id = ${id}`;
    // 不确定 job_id，失效所有 interviewees 缓存
    invalidateCache("interviewees:");
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
