"use server";

import sql from "@/lib/db";
import type { FeedbackData } from "@/types/response";

const submitFeedback = async (feedbackData: FeedbackData) => {
  const data = await sql`INSERT INTO feedback ${sql(feedbackData)} RETURNING *`;
  return data;
};

export const FeedbackService = {
  submitFeedback,
};
