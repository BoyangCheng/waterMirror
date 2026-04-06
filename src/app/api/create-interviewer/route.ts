import { INTERVIEWERS } from "@/lib/constants";
import { logger } from "@/lib/logger";
import { createInterviewer } from "@/services/interviewers.service";
import { type NextRequest, NextResponse } from "next/server";

// Volcengine TTS voice types (seed-tts-2.0) used as the "agent_id" for each interviewer
const VOICE_FEMALE = "zh_female_yingyujiaoxue_uranus_bigtts"; // 英语教学女声 — Lisa
const VOICE_MALE = "zh_male_dayi_uranus_bigtts";              // 大义男声 — Bob

export async function GET(_res: NextRequest) {
  logger.info("create-interviewer request received");

  try {
    const { audio: lisaAudio, i18nKey: _lk, ...lisaRest } = INTERVIEWERS.LISA;
    const lisa = await createInterviewer({
      agent_id: VOICE_FEMALE, // repurposed: stores TTS voice type
      ...lisaRest,
      audio: lisaAudio.en,
    });

    const { audio: bobAudio, i18nKey: _bk, ...bobRest } = INTERVIEWERS.BOB;
    const bob = await createInterviewer({
      agent_id: VOICE_MALE,
      ...bobRest,
      audio: bobAudio.en,
    });

    logger.info("Interviewers created successfully");

    return NextResponse.json({ lisa, bob }, { status: 200 });
  } catch (error) {
    logger.error("Error creating interviewers");
    return NextResponse.json({ error: "Failed to create interviewers" }, { status: 500 });
  }
}
