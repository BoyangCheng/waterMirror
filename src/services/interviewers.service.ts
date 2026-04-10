"use server";

import sql, { cachedQuery, invalidateCache } from "@/lib/db";
import type { Interviewer } from "@/types/interviewer";

const INTERVIEWERS_TTL = 10 * 60_000; // 10 分钟（静态配置数据）

const getAllInterviewers = async (_clientId = ""): Promise<Interviewer[]> => {
  try {
    return await cachedQuery<Interviewer[]>(
      "interviewers",
      async () => {
        const data = await sql<Interviewer[]>`SELECT * FROM interviewer`;
        return data ? Array.from(data) : [];
      },
      INTERVIEWERS_TTL,
    );
  } catch (error) {
    console.log(error);
    return [];
  }
};

const createInterviewer = async (payload: any): Promise<null> => {
  try {
    const existing = await sql<Interviewer[]>`
      SELECT * FROM interviewer
      WHERE name = ${payload.name} AND agent_id = ${payload.agent_id}
      LIMIT 1
    `;

    if (existing.length > 0) {
      console.error("An interviewer with this name already exists");
      return null;
    }

    await sql`INSERT INTO interviewer ${sql(payload)}`;
    invalidateCache("interviewers");
    return null;
  } catch (error) {
    console.error("Error creating interviewer:", error);
    return null;
  }
};

const getInterviewer = async (
  interviewerId: bigint,
): Promise<Interviewer | null> => {
  try {
    return await cachedQuery<Interviewer | null>(
      `interviewer:${interviewerId}`,
      async () => {
        const data = await sql<Interviewer[]>`SELECT * FROM interviewer WHERE id = ${Number(interviewerId)} LIMIT 1`;
        return data && data.length > 0 ? data[0] : null;
      },
      INTERVIEWERS_TTL,
    );
  } catch (error) {
    console.error("Error fetching interviewer:", error);
    return null;
  }
};

const deleteInterviewer = async (
  id: bigint,
): Promise<null | { error: unknown }> => {
  try {
    // 先解除 interview 表对该面试官的引用，避免外键约束报错
    await sql`UPDATE interview SET interviewer_id = NULL WHERE interviewer_id = ${Number(id)}`;
    await sql`DELETE FROM interviewer WHERE id = ${Number(id)}`;
    invalidateCache("interviewers");
    invalidateCache("interviews:");
    return null;
  } catch (error) {
    console.error("Error deleting interviewer:", error);
    return { error };
  }
};

export { getAllInterviewers, createInterviewer, getInterviewer, deleteInterviewer };
