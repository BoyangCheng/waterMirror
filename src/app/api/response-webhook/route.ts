// This webhook endpoint is kept for backwards compatibility.
// With Volcengine RTC, call analysis is triggered directly by the client
// after the call ends via /api/get-call. No external webhook is needed.
import { type NextRequest, NextResponse } from "next/server";

export async function POST(_req: NextRequest) {
  return NextResponse.json({ status: 204 });
}
