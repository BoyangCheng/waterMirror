import ai, { AI_MODELS } from "@/lib/ai";
import { logger } from "@/lib/logger";
import { getSystemPrompt, createUserPrompt } from "@/lib/prompts/generate-insights";
import { getInterviewById, updateInterview } from "@/services/interviews.service";
import { getAllResponses } from "@/services/responses.service";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  logger.info("generate-insights request received");
  const body = await req.json();

  const responses = await getAllResponses(body.interviewId);
  const interview = await getInterviewById(body.interviewId);

  if (!interview) {
    return NextResponse.json({ error: "Interview not found" }, { status: 404 });
  }

  // Use call_summary if available (Retell), fall back to plain transcript (Volcengine RTC)
  let callSummaries = "";
  if (responses) {
    for (const response of responses) {
      const summary = response.details?.call_analysis?.call_summary;
      const transcript = response.details?.transcript;
      if (summary) {
        callSummaries += `${summary}\n`;
      } else if (transcript) {
        callSummaries += `${transcript}\n`;
      }
    }
  }

  const language: "zh" | "en" = interview.language === "en" ? "en" : "zh";

  try {
    const prompt = createUserPrompt(
      callSummaries,
      interview.name,
      interview.objective,
      interview.description,
      language,
    );

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
    const insightsResponse = JSON.parse(content);

    await updateInterview(
      { insights: insightsResponse.insights },
      body.interviewId,
    );

    logger.info("Insights generated successfully");

    return NextResponse.json(
      {
        response: content,
      },
      { status: 200 },
    );
  } catch (error) {
    logger.error("Error generating insights");

    return NextResponse.json({ error: "internal server error" }, { status: 500 });
  }
}
