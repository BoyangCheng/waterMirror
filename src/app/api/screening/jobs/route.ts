import { logger } from "@/lib/logger";
import { getAllJobs } from "@/services/jobs.service";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId");
    const organizationId = searchParams.get("organizationId");

    if (!userId && !organizationId) {
      return NextResponse.json(
        { error: "userId or organizationId is required" },
        { status: 400 },
      );
    }

    const jobs = await getAllJobs(userId || "", organizationId || "");

    return NextResponse.json({ jobs }, { status: 200 });
  } catch (err) {
    logger.error("Error fetching jobs");
    console.error(err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
