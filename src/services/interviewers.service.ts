"use server";

import sql from "@/lib/db";

const getAllInterviewers = async (clientId = "") => {
  try {
    const data = await sql`SELECT * FROM interviewer`;
    return data || [];
  } catch (error) {
    console.log(error);
    return [];
  }
};

const createInterviewer = async (payload: any) => {
  try {
    const existing = await sql`
      SELECT * FROM interviewer
      WHERE name = ${payload.name} AND agent_id = ${payload.agent_id}
      LIMIT 1
    `;

    if (existing.length > 0) {
      console.error("An interviewer with this name already exists");
      return null;
    }

    await sql`INSERT INTO interviewer ${sql(payload)}`;
    return null;
  } catch (error) {
    console.error("Error creating interviewer:", error);
    return null;
  }
};

const getInterviewer = async (interviewerId: bigint) => {
  try {
    const data = await sql`SELECT * FROM interviewer WHERE id = ${interviewerId} LIMIT 1`;
    return data ? data[0] : null;
  } catch (error) {
    console.error("Error fetching interviewer:", error);
    return null;
  }
};

export { getAllInterviewers, createInterviewer, getInterviewer };
