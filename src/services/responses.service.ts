"use server";

import sql from "@/lib/db";
import type { FeedbackData } from "@/types/response";

const createResponse = async (payload: any) => {
  try {
    const [row] = await sql`INSERT INTO response ${sql(payload)} RETURNING id`;
    return row?.id;
  } catch (error) {
    console.log(error);
    return [];
  }
};

const saveResponse = async (payload: any, call_id: string) => {
  try {
    await sql`UPDATE response SET ${sql(payload)} WHERE call_id = ${call_id}`;
    return null;
  } catch (error) {
    console.log(error);
    return [];
  }
};

const getAllResponses = async (interviewId: string) => {
  try {
    const data = await sql`
      SELECT * FROM response
      WHERE interview_id = ${interviewId}
        AND (details IS NULL OR details->'call_analysis' IS NOT NULL)
        AND is_ended = true
      ORDER BY created_at DESC
    `;
    return data || [];
  } catch (error) {
    console.log(error);
    return [];
  }
};

const getResponseCountByOrganizationId = async (organizationId: string): Promise<number> => {
  try {
    const [row] = await sql`
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

const getAllEmailAddressesForInterview = async (interviewId: string) => {
  try {
    const data = await sql`SELECT email FROM response WHERE interview_id = ${interviewId}`;
    return data || [];
  } catch (error) {
    console.log(error);
    return [];
  }
};

const getResponseByCallId = async (id: string) => {
  try {
    const data = await sql`SELECT * FROM response WHERE call_id = ${id}`;
    return data ? data[0] : null;
  } catch (error) {
    console.log(error);
    return [];
  }
};

const deleteResponse = async (id: string) => {
  try {
    await sql`DELETE FROM response WHERE call_id = ${id}`;
    return null;
  } catch (error) {
    console.log(error);
    return [];
  }
};

const updateResponse = async (payload: any, call_id: string) => {
  try {
    await sql`UPDATE response SET ${sql(payload)} WHERE call_id = ${call_id}`;
    return null;
  } catch (error) {
    console.log(error);
    return [];
  }
};

export { createResponse, saveResponse, updateResponse, getAllResponses, getResponseByCallId, deleteResponse, getResponseCountByOrganizationId, getAllEmailAddressesForInterview as getAllEmails };
