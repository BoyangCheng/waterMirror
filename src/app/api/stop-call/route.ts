import { logger } from "@/lib/logger";
import { stopVoiceChat } from "@/lib/volcengine-rtc";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  logger.info("stop-call request received");

  try {
    const { room_id, task_id } = await req.json();

    if (!room_id || !task_id) {
      return NextResponse.json({ error: "room_id and task_id are required" }, { status: 400 });
    }

    await stopVoiceChat(room_id, task_id);

    logger.info("RTC voice chat stopped successfully");
    return NextResponse.json({ status: "stopped" }, { status: 200 });
  } catch (err) {
    logger.error("Error stopping RTC call");
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
