"use server";

import sql from "@/lib/db";

const getAllInterviews = async (userId: string, organizationId: string) => {
  try {
    const data = await sql`
      SELECT * FROM interview
      WHERE organization_id = ${organizationId} OR user_id = ${userId}
      ORDER BY created_at DESC
    `;
    return [...(data || [])];
  } catch (error) {
    console.log(error);
    return [];
  }
};

const getInterviewById = async (id: string) => {
  try {
    const data = await sql`
      SELECT * FROM interview
      WHERE id = ${id} OR readable_slug = ${id}
    `;
    return data ? data[0] : null;
  } catch (error) {
    console.log(error);
    return [];
  }
};

const updateInterview = async (payload: any, id: string) => {
  try {
    await sql`UPDATE interview SET ${sql(payload)} WHERE id = ${id}`;
    return null;
  } catch (error) {
    console.log(error);
    return [];
  }
};

const deleteInterview = async (id: string) => {
  try {
    await sql`DELETE FROM interview WHERE id = ${id}`;
    return null;
  } catch (error) {
    console.log(error);
    return [];
  }
};

const getAllRespondents = async (interviewId: string) => {
  try {
    const data = await sql`
      SELECT respondents FROM interview WHERE interview_id = ${interviewId}
    `;
    return data || [];
  } catch (error) {
    console.log(error);
    return [];
  }
};

const createInterview = async (payload: any) => {
  try {
    await sql`INSERT INTO interview ${sql(payload)}`;
    return null;
  } catch (error) {
    console.log(error);
    return [];
  }
};

const deactivateInterviewsByOrgId = async (organizationId: string) => {
  try {
    await sql`
      UPDATE interview SET is_active = false
      WHERE organization_id = ${organizationId} AND is_active = true
    `;
  } catch (error) {
    console.error("Unexpected error disabling interviews:", error);
  }
};

export const InterviewService = {
  getAllInterviews,
  getInterviewById,
  updateInterview,
  deleteInterview,
  getAllRespondents,
  createInterview,
  deactivateInterviewsByOrgId,
};
