"use server";

import sql, { cachedQuery, invalidateCache } from "@/lib/db";
import type { Job } from "@/types/job";

const JOBS_TTL = 30_000;  // 30 秒（有轮询，短一点）
const JOB_TTL = 60_000;   // 1 分钟

const createJob = async (payload: {
  id: string;
  name: string;
  description: string;
  organization_id: string;
  user_id: string;
  status: string;
}): Promise<null | { error: unknown }> => {
  try {
    await sql`INSERT INTO job ${sql(payload)}`;
    invalidateCache("jobs:");
    return null;
  } catch (error) {
    console.log(error);
    return { error };
  }
};

const getAllJobs = async (
  userId: string,
  organizationId: string,
): Promise<Job[]> => {
  try {
    return await cachedQuery<Job[]>(
      `jobs:${organizationId}:${userId}`,
      async () => {
        const data = await sql<Job[]>`
          SELECT * FROM job
          WHERE organization_id = ${organizationId} OR user_id = ${userId}
          ORDER BY created_at DESC
        `;
        return data ? Array.from(data) : [];
      },
      JOBS_TTL,
    );
  } catch (error) {
    console.log(error);
    return [];
  }
};

const getJobById = async (jobId: string): Promise<Job | null> => {
  try {
    return await cachedQuery<Job | null>(
      `job:${jobId}`,
      async () => {
        const data = await sql<Job[]>`
          SELECT * FROM job WHERE id = ${jobId}
        `;
        return data && data.length > 0 ? data[0] : null;
      },
      JOB_TTL,
    );
  } catch (error) {
    console.log(error);
    return null;
  }
};

const updateJobStatus = async (
  jobId: string,
  status: string,
): Promise<null | { error: unknown }> => {
  try {
    await sql`UPDATE job SET status = ${status} WHERE id = ${jobId}`;
    invalidateCache("jobs:");
    invalidateCache(`job:${jobId}`);
    return null;
  } catch (error) {
    console.log(error);
    return { error };
  }
};

const deleteJob = async (
  jobId: string,
): Promise<null | { error: unknown }> => {
  try {
    await sql`DELETE FROM job WHERE id = ${jobId}`;
    invalidateCache("jobs:");
    invalidateCache(`job:${jobId}`);
    return null;
  } catch (error) {
    console.log(error);
    return { error };
  }
};

export { createJob, getAllJobs, getJobById, updateJobStatus, deleteJob };
