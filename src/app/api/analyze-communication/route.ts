import ai, { AI_MODELS } from "@/lib/ai";
import { logger } from "@/lib/logger";
import {
  getSystemPrompt,
  getCommunicationAnalysisPrompt,
} from "@/lib/prompts/communication-analysis";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  logger.info("analyze-communication request received");

  try {
    const body = await req.json();
    const { transcript } = body;
    const language: "zh" | "en" = body.language === "en" ? "en" : "zh";

    if (!transcript) {
      return NextResponse.json({ error: "Transcript is required" }, { status: 400 });
    }

    const completion = await ai.chat.completions.create({
      model: AI_MODELS.smart,
      messages: [
        {
          role: "system",
          content: getSystemPrompt(language),
        },
        {
          role: "user",
          content: getCommunicationAnalysisPrompt(transcript, language),
        },
      ],
      response_format: { type: "json_object" },
    });

    const analysis = completion.choices[0]?.message?.content;

    logger.info("Communication analysis completed successfully");

    return NextResponse.json({ analysis: JSON.parse(analysis || "{}") }, { status: 200 });
  } catch (error) {
    logger.error("Error analyzing communication skills");

    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
