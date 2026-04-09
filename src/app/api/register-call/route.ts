import { logger } from "@/lib/logger";
import {
  buildInterviewerPrompt,
  generateRTCToken,
  startVoiceChat,
} from "@/lib/volcengine-rtc";
import { getCachedOrganizationById } from "@/services/clients.service";
import { getInterviewer } from "@/services/interviewers.service";
import { nanoid } from "nanoid";
import { NextResponse } from "next/server";

// Volcengine TTS voice types (seed-tts-2.0) per interviewer
// agent_id field is repurposed to store the voice type string
const DEFAULT_VOICE_FEMALE = "zh_female_yingyujiaoxue_uranus_bigtts"; // 英语教学女声
const DEFAULT_VOICE_MALE = "zh_male_dayi_uranus_bigtts";              // 大义男声

export async function POST(req: Request) {
  logger.info("register-call request received");

  try {
    const body = await req.json();
    const { dynamic_data, interviewer_id, organization_id } = body;

    const [interviewer, organization] = await Promise.all([
      getInterviewer(interviewer_id),
      organization_id ? getCachedOrganizationById(organization_id) : Promise.resolve(null),
    ]);
    const orgName = organization?.name?.trim() || "";

    // Unique IDs for this call session
    const roomId = nanoid();
    const taskId = nanoid();
    const userId = `user_${nanoid()}`;
    const agentUserId = `agent_${nanoid()}`;

    const appId = process.env.VOLCENGINE_RTC_APP_ID ?? "";
    const appKey = process.env.VOLCENGINE_RTC_APP_KEY ?? "";

    if (!appId || !appKey) {
      logger.error(
        `Missing Volcengine RTC credentials: APP_ID=${appId ? "set" : "MISSING"}, APP_KEY=${appKey ? "set" : "MISSING"}`,
      );
      return NextResponse.json(
        { error: "RTC service not configured — missing VOLCENGINE_RTC_APP_ID or VOLCENGINE_RTC_APP_KEY" },
        { status: 500 },
      );
    }

    // Generate RTC access token for the human user
    const token = generateRTCToken(appId, appKey, roomId, userId);
    logger.info(`RTC token generated for room=${roomId}, user=${userId}, appId=${appId.slice(0, 6)}...`);

    // Build the system prompt from interview data + interviewer style
    const systemPrompt = buildInterviewerPrompt({
      mins: dynamic_data.mins ?? "10",
      name: dynamic_data.name ?? "not provided",
      objective: dynamic_data.objective ?? "",
      questions: dynamic_data.questions ?? "",
      language: dynamic_data.language ?? "zh",
      interviewer: interviewer
        ? {
            empathy: interviewer.empathy,
            exploration: interviewer.exploration,
            rapport: interviewer.rapport,
            speed: interviewer.speed,
          }
        : undefined,
    });

    // Determine voice type: use agent_id field if it looks like a TTS voice type,
    // otherwise fall back to defaults based on interviewer name
    const voiceType =
      interviewer?.agent_id?.includes("_uranus_bigtts")
        ? interviewer.agent_id
        : interviewer?.name?.toLowerCase().includes("bob")
          ? DEFAULT_VOICE_MALE
          : DEFAULT_VOICE_FEMALE;

    const welcomeMessage =
      dynamic_data.language === "en"
        ? `Hello${dynamic_data.name !== "not provided" ? ` ${dynamic_data.name}` : ""}! My name is Cheng, I'll be your interviewer today. I've been working in HR${orgName ? ` at ${orgName}` : ""} for two years, mainly handling personnel management, recruitment, and day-to-day HR coordination. Please relax — let's just have a casual chat. Could you start by briefly walking me through your background?`
        : `你好${dynamic_data.name !== "not provided" ? `，${dynamic_data.name}` : ""}，我姓程，是今天的面试官。我在${orgName || "本公司"}从事 HR 工作两年，主要负责人事管理、招聘配置及日常人事事务统筹。接下来不用紧张，咱们就轻松聊一聊。你可以先简单介绍一下自己的过往经历。`;

    // Start the AI voice agent in the RTC room
    await startVoiceChat({
      roomId,
      taskId,
      agentUserId,
      targetUserId: userId,
      systemPrompt,
      language: dynamic_data.language ?? "zh",
      welcomeMessage,
      voiceType,
    });

    logger.info("RTC voice chat started successfully");

    return NextResponse.json(
      {
        registerCallResponse: {
          call_id: roomId,   // reuse call_id field for backwards compat
          room_id: roomId,
          task_id: taskId,
          user_id: userId,
          agent_user_id: agentUserId,
          app_id: appId,
          token,
        },
      },
      { status: 200 },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : undefined;
    logger.error(`Error registering RTC call: ${message}`);
    console.error("[register-call] error:", err);
    return NextResponse.json(
      { error: message, stack },
      { status: 500 },
    );
  }
}
