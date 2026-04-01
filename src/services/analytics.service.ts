"use server";

import ai, { AI_MODELS } from "@/lib/ai";
import { getSystemPrompt, getInterviewAnalyticsPrompt } from "@/lib/prompts/analytics";
import { getInterviewById } from "@/services/interviews.service";
import { getResponseByCallId } from "@/services/responses.service";
import type { Question } from "@/types/interview";
import type { Analytics } from "@/types/response";

export const generateInterviewAnalytics = async (payload: {
  callId: string;
  interviewId: string;
  transcript: string;
}) => {
  const { callId, interviewId, transcript } = payload;

  try {
    const response = await getResponseByCallId(callId);
    const interview = await getInterviewById(interviewId);

    if (response.analytics) {
      return { analytics: response.analytics as Analytics, status: 200 };
    }

    const interviewTranscript = transcript || response.details?.transcript;
    const questions = interview?.questions || [];
    const mainInterviewQuestions = questions
      .map((q: Question, index: number) => `${index + 1}. ${q.question}`)
      .join("\n");
    const language: "zh" | "en" = interview?.language === "en" ? "en" : "zh";

    const prompt = getInterviewAnalyticsPrompt(interviewTranscript, mainInterviewQuestions, language);

    const baseCompletion = await ai.chat.completions.create({
      model: AI_MODELS.smart,
      messages: [
        {
          role: "system",
          content: getSystemPrompt(language),
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      response_format: { type: "json_object" },
    });

    const basePromptOutput = baseCompletion.choices[0] || {};
    const content = basePromptOutput.message?.content || "";
    const analyticsResponse = JSON.parse(content);

    analyticsResponse.mainInterviewQuestions = questions.map((q: Question) => q.question);

    return { analytics: analyticsResponse, status: 200 };
  } catch (error) {
    console.error("Error in OpenAI request:", error);

    return { error: "internal server error", status: 500 };
  }
};
