import { logger } from "@/lib/logger";
import { generateInterviewAnalytics } from "@/services/analytics.service";
import { getResponseByCallId, saveResponse } from "@/services/responses.service";
import type { Response } from "@/types/response";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  logger.info("get-call request received");
  const body = await req.json();

  const callDetails: Response | null = await getResponseByCallId(body.id);

  if (!callDetails) {
    return NextResponse.json({ error: "Call not found" }, { status: 404 });
  }

  const callResponse = callDetails.details;

  if (callDetails.is_analysed) {
    return NextResponse.json(
      { callResponse, analytics: callDetails.analytics },
      { status: 200 },
    );
  }

  // Transcript is accumulated by the client and stored in details.transcript
  const transcript: string = callResponse?.transcript ?? "";

  if (!transcript) {
    logger.info("No transcript available yet for call", body.id);
    return NextResponse.json({ callResponse, analytics: null }, { status: 200 });
  }

  const interviewId = callDetails?.interview_id;
  const startTs: number = callResponse?.start_timestamp ?? 0;
  const endTs: number = callResponse?.end_timestamp ?? Date.now();
  const duration = Math.round((endTs - startTs) / 1000);

  const payload = {
    callId: body.id,
    interviewId,
    transcript,
  };

  const result = await generateInterviewAnalytics(payload);
  const analytics = result.analytics;

  await saveResponse(
    {
      is_analysed: true,
      duration,
      analytics,
    },
    body.id,
  );

  logger.info("Call analysed successfully");

  return NextResponse.json({ callResponse, analytics }, { status: 200 });
}
