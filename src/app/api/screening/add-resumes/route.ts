import { logger } from "@/lib/logger";
import { uploadToOSS, getResumeObjectKey } from "@/lib/oss";
import { getJobById, updateJobStatus } from "@/services/jobs.service";
import { createInterviewee } from "@/services/interviewees.service";
import { NextResponse } from "next/server";

export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const jobId = formData.get("job_id") as string;
    const files = formData.getAll("files") as File[];

    if (!jobId || files.length === 0) {
      return NextResponse.json(
        { error: "job_id and at least one file are required" },
        { status: 400 },
      );
    }

    if (files.length > 10) {
      return NextResponse.json(
        { error: "Maximum 10 files allowed" },
        { status: 400 },
      );
    }

    const job = await getJobById(jobId);
    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    logger.info("Adding resumes to existing job", { jobId, count: files.length });

    // Update job status back to processing
    await updateJobStatus(jobId, "processing");

    // Upload files and create interviewee records
    for (const file of files) {
      const buffer = Buffer.from(await file.arrayBuffer());
      const objectKey = getResumeObjectKey(jobId, file.name);
      const resumeUrl = await uploadToOSS(buffer, objectKey);

      await createInterviewee({
        job_id: jobId,
        resume_url: resumeUrl,
        original_filename: file.name,
        status: "pending",
      });
    }

    // Trigger async processing
    const baseUrl = process.env.NEXT_PUBLIC_LIVE_URL || "http://localhost:3000";
    fetch(`${baseUrl}/api/screening/process-resumes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jobId }),
    }).catch((err) => {
      logger.error("Failed to trigger resume processing", err);
    });

    return NextResponse.json(
      { status: "processing" },
      { status: 200 },
    );
  } catch (err) {
    logger.error("Error adding resumes");
    console.error(err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
