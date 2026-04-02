import { logger } from "@/lib/logger";
import { uploadToOSS, getResumeObjectKey } from "@/lib/oss";
import { createJob } from "@/services/jobs.service";
import { createInterviewee } from "@/services/interviewees.service";
import { nanoid } from "nanoid";
import { NextResponse } from "next/server";

export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const name = formData.get("name") as string;
    const description = formData.get("description") as string;
    const organizationId = formData.get("organization_id") as string;
    const userId = formData.get("user_id") as string;
    const files = formData.getAll("files") as File[];

    if (!name || !description || files.length === 0) {
      return NextResponse.json(
        { error: "Name, description and at least one resume are required" },
        { status: 400 },
      );
    }

    if (files.length > 10) {
      return NextResponse.json(
        { error: "Maximum 10 files allowed" },
        { status: 400 },
      );
    }

    const jobId = nanoid();
    logger.info("Creating screening job", { jobId, name });

    // Create job record
    await createJob({
      id: jobId,
      name,
      description,
      organization_id: organizationId,
      user_id: userId,
      status: "processing",
    });

    // Upload files to OSS and create interviewee records
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

    logger.info("Job created, triggering async resume processing", { jobId });

    // Trigger async processing (fire and forget)
    const baseUrl = process.env.NEXT_PUBLIC_LIVE_URL || "http://localhost:3000";
    fetch(`${baseUrl}/api/screening/process-resumes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jobId }),
    }).catch((err) => {
      logger.error("Failed to trigger resume processing", err);
    });

    return NextResponse.json(
      { jobId, status: "processing" },
      { status: 200 },
    );
  } catch (err) {
    logger.error("Error creating screening job");
    console.error(err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
