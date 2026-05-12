// 标记通知已读（POST）
//
// 调用方式：
//   POST /api/notifications/mark-read
//   body: { responseId: number }      → 单条标已读
//   body: { all: true }                → 全部标已读
//
// 安全：UPDATE 必须用 session.orgId 限定，防止恶意标记他人 org 的 response

import { auth } from "@/lib/auth";
import sql from "@/lib/db";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const responseId = typeof body.responseId === "number" ? body.responseId : null;
    const markAll = body.all === true;

    if (markAll) {
      // 当前 org 所有未读 response 标已读
      await sql`
        UPDATE response
        SET is_viewed = true
        WHERE is_viewed = false
          AND interview_id IN (
            SELECT id FROM interview WHERE organization_id = ${session.orgId}
          )
      `;
    } else if (responseId !== null) {
      await sql`
        UPDATE response
        SET is_viewed = true
        WHERE id = ${responseId}
          AND interview_id IN (
            SELECT id FROM interview WHERE organization_id = ${session.orgId}
          )
      `;
    } else {
      return NextResponse.json({ error: "missing responseId or all flag" }, { status: 400 });
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err) {
    console.error("[/api/notifications/mark-read] failed:", err);
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}
