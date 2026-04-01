import { logger } from "@/lib/logger";
import { createInterview } from "@/services/interviews.service";
import { nanoid } from "nanoid";
import { NextResponse } from "next/server";

const base_url = process.env.NEXT_PUBLIC_LIVE_URL;

export async function POST(req: Request) {
  try {
    const url_id = nanoid();
    const url = `${base_url}/call/${url_id}`;
    const body = await req.json();

    logger.info("create-interview request received");

    const payload = body.interviewData;

    // Convert a string to a URL-safe ASCII slug (strips non-ASCII characters like CJK)
    const toSlug = (str: string): string =>
      str
        .toLowerCase()
        .replace(/[^\x00-\x7F]/g, "") // remove non-ASCII (Chinese, etc.)
        .replace(/\s+/g, "-")          // spaces → hyphens
        .replace(/[^a-z0-9-]/g, "")   // remove remaining special chars
        .replace(/-+/g, "-")           // collapse consecutive hyphens
        .replace(/^-|-$/g, "");        // trim leading/trailing hyphens

    let readableSlug = null;
    if (body.organizationName) {
      const interviewNameSlug = toSlug(payload.name ?? "");
      const orgNameSlug = toSlug(body.organizationName ?? "");
      // Only set readable slug if both parts yield valid ASCII slugs
      if (orgNameSlug && interviewNameSlug) {
        readableSlug = `${orgNameSlug}-${interviewNameSlug}`;
      }
    }

    const newInterview = await createInterview({
      ...payload,
      url: url,
      id: url_id,
      readable_slug: readableSlug,
    });

    logger.info("Interview created successfully");

    return NextResponse.json({ response: "Interview created successfully" }, { status: 200 });
  } catch (err) {
    logger.error("Error creating interview");

    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
