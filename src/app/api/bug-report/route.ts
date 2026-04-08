import sql from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const rows = await sql`
      SELECT id, created_at, email, feedback
      FROM feedback
      WHERE satisfaction = -1
      ORDER BY created_at DESC
      LIMIT 200
    `;

    const items = rows
      .map((row: { id: number; created_at: string; email: string | null; feedback: string | null }) => {
        let parsed: Record<string, unknown> | null = null;
        try {
          parsed = row.feedback ? JSON.parse(row.feedback) : null;
        } catch {
          parsed = null;
        }
        if (!parsed || parsed.type !== "bug_report") return null;
        return {
          id: row.id,
          createdAt: row.created_at,
          email: row.email,
          description: (parsed.description as string) || "",
          solution: (parsed.solution as string) || "",
          pageUrl: (parsed.pageUrl as string) || null,
          userAgent: (parsed.userAgent as string) || null,
          consoleLogs: Array.isArray(parsed.consoleLogs) ? parsed.consoleLogs : [],
        };
      })
      .filter(Boolean);

    return NextResponse.json({ items }, { status: 200 });
  } catch (error) {
    console.error("[Bug Report] failed to list:", error);
    return NextResponse.json({ error: "Failed to list bug reports" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { description, solution, email, consoleLogs, pageUrl, userAgent } = await req.json();

    if (!description || !solution) {
      return NextResponse.json({ error: "description and solution are required" }, { status: 400 });
    }

    // 仅保留最近 200 条，防止异常负载
    const trimmedLogs = Array.isArray(consoleLogs) ? consoleLogs.slice(-200) : [];

    const feedbackText = JSON.stringify({
      type: "bug_report",
      description,
      solution,
      pageUrl: pageUrl || null,
      userAgent: userAgent || null,
      consoleLogs: trimmedLogs,
    });

    await sql`
      INSERT INTO feedback (email, feedback, satisfaction)
      VALUES (${email || null}, ${feedbackText}, ${-1})
    `;

    console.log("[Bug Report] saved to DB →", {
      description,
      solution,
      email: email || "(none)",
      consoleLogCount: trimmedLogs.length,
    });

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("[Bug Report] failed to save:", error);
    return NextResponse.json({ error: "Failed to save bug report" }, { status: 500 });
  }
}
