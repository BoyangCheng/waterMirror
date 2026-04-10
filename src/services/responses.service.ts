"use server";

import sql from "@/lib/db";
import type { Response } from "@/types/response";

const createResponse = async (payload: any): Promise<bigint | null> => {
  try {
    const [row] = await sql<{ id: bigint }[]>`INSERT INTO response ${sql(payload)} RETURNING id`;
    return row?.id ?? null;
  } catch (error) {
    console.log(error);
    return null;
  }
};

const saveResponse = async (payload: any, call_id: string): Promise<null> => {
  try {
    await sql`UPDATE response SET ${sql(payload)} WHERE call_id = ${call_id}`;
    return null;
  } catch (error) {
    console.log(error);
    return null;
  }
};

const getAllResponses = async (interviewId: string): Promise<Response[]> => {
  try {
    const data = await sql<Response[]>`
      SELECT * FROM response
      WHERE interview_id = ${interviewId}
        AND is_ended = true
      ORDER BY created_at DESC
    `;
    return data ? Array.from(data) : [];
  } catch (error) {
    console.log(error);
    return [];
  }
};

const getResponseCountByOrganizationId = async (organizationId: string): Promise<number> => {
  try {
    const [row] = await sql<{ count: number }[]>`
      SELECT COUNT(r.id)::int AS count
      FROM interview i
      LEFT JOIN response r ON r.interview_id = i.id
      WHERE i.organization_id = ${organizationId}
    `;
    return row?.count ?? 0;
  } catch (error) {
    console.log(error);
    return 0;
  }
};

const getAllEmailAddressesForInterview = async (
  interviewId: string,
): Promise<{ email: string }[]> => {
  try {
    const data = await sql<{ email: string }[]>`SELECT email FROM response WHERE interview_id = ${interviewId}`;
    return data ? Array.from(data) : [];
  } catch (error) {
    console.log(error);
    return [];
  }
};

const getResponseByCallId = async (id: string): Promise<Response | null> => {
  try {
    const data = await sql<Response[]>`SELECT * FROM response WHERE call_id = ${id}`;
    return data && data.length > 0 ? data[0] : null;
  } catch (error) {
    console.log(error);
    return null;
  }
};

const deleteResponse = async (id: string): Promise<null> => {
  try {
    await sql`DELETE FROM response WHERE call_id = ${id}`;
    return null;
  } catch (error) {
    console.log(error);
    return null;
  }
};

const updateResponse = async (payload: any, call_id: string): Promise<null> => {
  try {
    await sql`UPDATE response SET ${sql(payload)} WHERE call_id = ${call_id}`;
    return null;
  } catch (error) {
    console.log(error);
    return null;
  }
};

export { createResponse, saveResponse, updateResponse, getAllResponses, getResponseByCallId, deleteResponse, getResponseCountByOrganizationId, getAllEmailAddressesForInterview as getAllEmails };
