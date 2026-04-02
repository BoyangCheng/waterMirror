import { logger } from "@/lib/logger";
import { getJobById } from "@/services/jobs.service";
import { getIntervieweesByJobId } from "@/services/interviewees.service";
import { NextResponse } from "next/server";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ jobId: string }> },
) {
  try {
    const { jobId } = await params;

    const job = await getJobById(jobId);
    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    const interviewees = await getIntervieweesByJobId(jobId);

    return NextResponse.json({ job, interviewees }, { status: 200 });
  } catch (err) {
    logger.error("Error fetching job details");
    console.error(err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
