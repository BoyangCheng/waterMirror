"use server";

import sql, { cachedQuery, invalidateCache } from "@/lib/db";
import type { Interview } from "@/types/interview";

const INTERVIEWS_TTL = 60_000; // 1 分钟
const INTERVIEW_TTL = 5 * 60_000; // 5 分钟

const getAllInterviews = async (
  userId: string,
  organizationId: string,
): Promise<Interview[]> => {
  try {
    return await cachedQuery<Interview[]>(
      `interviews:${organizationId}:${userId}`,
      async () => {
        const data = await sql<Interview[]>`
          SELECT * FROM interview
          WHERE organization_id = ${organizationId} OR user_id = ${userId}
          ORDER BY created_at DESC
        `;
        return data ? Array.from(data) : [];
      },
      INTERVIEWS_TTL,
    );
  } catch (error) {
    console.log(error);
    return [];
  }
};

const getInterviewById = async (id: string): Promise<Interview | null> => {
  try {
    return await cachedQuery<Interview | null>(
      `interview:${id}`,
      async () => {
        const data = await sql<Interview[]>`
          SELECT * FROM interview
          WHERE id = ${id} OR readable_slug = ${id}
        `;
        return data && data.length > 0 ? data[0] : null;
      },
      INTERVIEW_TTL,
    );
  } catch (error) {
    console.log(error);
    return null;
  }
};

const updateInterview = async (payload: any, id: string): Promise<null> => {
  try {
    await sql`UPDATE interview SET ${sql(payload)} WHERE id = ${id}`;
    invalidateCache("interviews:");
    invalidateCache(`interview:${id}`);
    return null;
  } catch (error) {
    console.log(error);
    return null;
  }
};

const deleteInterview = async (id: string): Promise<null> => {
  console.log("[deleteInterview][server] called → id:", id);
  try {
    // 先删关联的 responses，避免外键约束报错
    await sql`DELETE FROM response WHERE interview_id = ${id}`;
    await sql`DELETE FROM interview WHERE id = ${id}`;
    invalidateCache("interviews:");
    invalidateCache(`interview:${id}`);
    return null;
  } catch (error) {
    console.error("[deleteInterview][server] ERROR:", error);
    throw error;
  }
};

const getAllRespondents = async (
  interviewId: string,
): Promise<{ respondents: string[] }[]> => {
  try {
    const data = await sql<{ respondents: string[] }[]>`
      SELECT respondents FROM interview WHERE interview_id = ${interviewId}
    `;
    return data ? Array.from(data) : [];
  } catch (error) {
    console.log(error);
    return [];
  }
};

const createInterview = async (payload: any): Promise<null> => {
  try {
    await sql`INSERT INTO interview ${sql(payload)}`;
    invalidateCache("interviews:");
    return null;
  } catch (error) {
    console.log(error);
    return null;
  }
};

const deactivateInterviewsByOrgId = async (organizationId: string): Promise<void> => {
  try {
    await sql`
      UPDATE interview SET is_active = false
      WHERE organization_id = ${organizationId} AND is_active = true
    `;
    invalidateCache("interviews:");
  } catch (error) {
    console.error("Unexpected error disabling interviews:", error);
  }
};

export { getAllInterviews, getInterviewById, updateInterview, deleteInterview, getAllRespondents, createInterview, deactivateInterviewsByOrgId };
