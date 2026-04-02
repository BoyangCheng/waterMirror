"use server";

import sql from "@/lib/db";

const createJob = async (payload: {
  id: string;
  name: string;
  description: string;
  organization_id: string;
  user_id: string;
  status: string;
}) => {
  try {
    await sql`INSERT INTO job ${sql(payload)}`;
    return null;
  } catch (error) {
    console.log(error);
    return { error };
  }
};

const getAllJobs = async (userId: string, organizationId: string) => {
  try {
    const data = await sql`
      SELECT * FROM job
      WHERE organization_id = ${organizationId} OR user_id = ${userId}
      ORDER BY created_at DESC
    `;
    return [...(data || [])];
  } catch (error) {
    console.log(error);
    return [];
  }
};

const getJobById = async (jobId: string) => {
  try {
    const data = await sql`
      SELECT * FROM job WHERE id = ${jobId}
    `;
    return data ? data[0] : null;
  } catch (error) {
    console.log(error);
    return null;
  }
};

const updateJobStatus = async (jobId: string, status: string) => {
  try {
    await sql`UPDATE job SET status = ${status} WHERE id = ${jobId}`;
    return null;
  } catch (error) {
    console.log(error);
    return { error };
  }
};

const deleteJob = async (jobId: string) => {
  try {
    await sql`DELETE FROM job WHERE id = ${jobId}`;
    return null;
  } catch (error) {
    console.log(error);
    return { error };
  }
};

export { createJob, getAllJobs, getJobById, updateJobStatus, deleteJob };
