import { INTERVIEWERS } from "@/lib/constants";
import { logger } from "@/lib/logger";
import { createInterviewer } from "@/services/interviewers.service";
import { type NextRequest, NextResponse } from "next/server";

// Volcengine TTS voice types used as the "agent_id" for each interviewer
const VOICE_FEMALE = "BV701_streaming"; // 灿灿 (cheerful female) — Lisa
const VOICE_MALE = "BV406_streaming";   // 博文 (professional male) — Bob

export async function GET(_res: NextRequest) {
  logger.info("create-interviewer request received");

  try {
    const lisa = await createInterviewer({
      agent_id: VOICE_FEMALE, // repurposed: stores TTS voice type
      ...INTERVIEWERS.LISA,
    });

    const bob = await createInterviewer({
      agent_id: VOICE_MALE,
      ...INTERVIEWERS.BOB,
    });

    logger.info("Interviewers created successfully");

    return NextResponse.json({ lisa, bob }, { status: 200 });
  } catch (error) {
    logger.error("Error creating interviewers");
    return NextResponse.json({ error: "Failed to create interviewers" }, { status: 500 });
  }
}
