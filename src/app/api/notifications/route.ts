// 通知列表 API（GET）
//
// 数据来源：实时聚合 response 表，不存独立 notifications 表。
//   - 已结束的面试（is_ended=true）但未读（is_viewed=false）→ "completed" 通知
//   - 同时分数 >= 85 的标记为 "high_score"（更醒目的展示）
// 时间范围：最近 30 天，最多 50 条
//
// V2 待加：新简历通知、系统公告
//
// 鉴权：必须有 session，按 session.orgId 过滤数据

import { auth } from "@/lib/auth";
import sql from "@/lib/db";
import { NextResponse } from "next/server";

interface NotificationRow {
  id: number;
  call_id: string | null;
  candidate_name: string | null;
  candidate_email: string | null;
  created_at: Date;
  is_viewed: boolean;
  score: string | null;
  interview_name: string | null;
  interview_id: string;
}

const HIGH_SCORE_THRESHOLD = 85;

export async function GET() {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const rows = await sql<NotificationRow[]>`
      SELECT
        r.id,
        r.call_id,
        r.name AS candidate_name,
        r.email AS candidate_email,
        r.created_at,
        r.is_viewed,
        r.analytics->>'overallScore' AS score,
        i.name AS interview_name,
        i.id AS interview_id
      FROM response r
      JOIN interview i ON i.id = r.interview_id
      WHERE i.organization_id = ${session.orgId}
        AND r.is_ended = true
        AND r.created_at > NOW() - INTERVAL '30 days'
      ORDER BY r.created_at DESC
      LIMIT 50
    `;

    const notifications = rows.map((r) => {
      const scoreNum = r.score ? Number(r.score) : null;
      const isHighScore = scoreNum !== null && scoreNum >= HIGH_SCORE_THRESHOLD;
      return {
        id: r.id,
        type: isHighScore ? ("high_score" as const) : ("completed" as const),
        candidateName: r.candidate_name ?? r.candidate_email ?? "—",
        interviewName: r.interview_name ?? "—",
        interviewId: r.interview_id,
        callId: r.call_id,
        score: scoreNum,
        isRead: r.is_viewed,
        createdAt: r.created_at,
      };
    });

    const unreadCount = notifications.filter((n) => !n.isRead).length;

    return NextResponse.json({ notifications, unreadCount }, { status: 200 });
  } catch (err) {
    console.error("[/api/notifications] failed:", err);
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}
