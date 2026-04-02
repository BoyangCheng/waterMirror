import ai, { AI_MODELS } from "@/lib/ai";
import { logger } from "@/lib/logger";
import {
  RESUME_SCREENING_SYSTEM_PROMPT,
  getResumeScreeningPrompt,
} from "@/lib/prompts/resume-screening";
import { getJobById, updateJobStatus } from "@/services/jobs.service";
import {
  getPendingIntervieweesByJobId,
  updateInterviewee,
} from "@/services/interviewees.service";
import { PDFLoader } from "langchain/document_loaders/fs/pdf";
import { NextResponse } from "next/server";

export const maxDuration = 300; // 5 minutes for processing multiple resumes

async function fetchAndParsePdf(url: string): Promise<string> {
  const response = await fetch(url);
  const blob = await response.blob();
  const loader = new PDFLoader(blob);
  const docs = await loader.load();
  return docs.map((doc) => doc.pageContent).join("\n");
}

async function analyzeResume(
  jobDescription: string,
  resumeText: string,
): Promise<{
  name: string;
  company: string;
  position: string;
  summary: string;
  score: number;
}> {
  const completion = await ai.chat.completions.create({
    model: AI_MODELS.smart,
    messages: [
      { role: "system", content: RESUME_SCREENING_SYSTEM_PROMPT },
      {
        role: "user",
        content: getResumeScreeningPrompt(jobDescription, resumeText),
      },
    ],
    temperature: 0.3,
  });

  const content = completion.choices[0]?.message?.content || "{}";
  // Clean up potential markdown code blocks
  const cleaned = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
  return JSON.parse(cleaned);
}

export async function POST(req: Request) {
  try {
    const { jobId } = await req.json();

    if (!jobId) {
      return NextResponse.json({ error: "jobId is required" }, { status: 400 });
    }

    logger.info("Starting resume processing", { jobId });

    const job = await getJobById(jobId);
    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    const pendingInterviewees = await getPendingIntervieweesByJobId(jobId);

    for (const interviewee of pendingInterviewees) {
      try {
        // Parse the resume PDF from OSS URL
        const resumeText = await fetchAndParsePdf(interviewee.resume_url);

        // Analyze with AI
        const result = await analyzeResume(job.description, resumeText);

        // Update the interviewee record
        await updateInterviewee(interviewee.id, {
          name: result.name || "未知",
          company: result.company || "未知",
          position: result.position || "未知",
          summary: result.summary || "",
          score: Math.min(100, Math.max(0, result.score || 0)),
          status: "analyzed",
        });

        logger.info(`Analyzed resume for ${result.name}`, {
          score: result.score,
        });
      } catch (err) {
        logger.error(`Failed to process interviewee ${interviewee.id}`);
        console.error(err);
        await updateInterviewee(interviewee.id, {
          status: "error",
          summary: "简历解析失败",
        });
      }
    }

    // Mark job as completed
    await updateJobStatus(jobId, "completed");
    logger.info("Resume processing completed", { jobId });

    return NextResponse.json({ status: "completed" }, { status: 200 });
  } catch (err) {
    logger.error("Error processing resumes");
    console.error(err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
