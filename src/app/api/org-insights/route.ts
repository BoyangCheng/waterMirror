// org_insights GET API ——
// dashboard 顶部 ticker 拉这里。
//
// 流程：
//   1. 立即返回当前 org 未过期的 insights（即使是 1h 前生成的）→ 用户体验好
//   2. 同时检查上次生成时间，> 1h 就 fire-and-forget 触发后台重生成
//      下次再来就是新数据
//
// 鉴权：按 session.orgId 过滤。

import { auth } from "@/lib/auth";
import {
  generateInsightsForOrg,
  getActiveInsights,
  shouldRegenerate,
} from "@/services/insights.service";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  if (!session?.orgId) {
    return NextResponse.json({ insights: [] }, { status: 200 });
  }

  const insights = await getActiveInsights(session.orgId);

  // fire-and-forget：不 await，让 GET 立即返回
  shouldRegenerate(session.orgId).then((needs) => {
    if (needs) {
      generateInsightsForOrg(session.orgId).catch(() => {});
    }
  });

  return NextResponse.json({ insights }, { status: 200 });
}
