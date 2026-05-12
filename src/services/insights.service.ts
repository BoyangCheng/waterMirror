// org insights 服务 ——
// dashboard 顶部"动态条"的内容来源。每个 org 有自己的一组 insights，
// 通过 lazy 触发的方式在用户进 dashboard 时检查是否需要刷新（>1h 触发）。
//
// 生成策略：
//   1. 先 DELETE 该 org 所有过期的 insight（清理）
//   2. 再 DELETE 该 org 所有 insight（清空旧批次）
//   3. 跑 10 个查询，每个查询返回 0~1 条 insight 结构
//   4. 批量 INSERT
//
// 文案现阶段只支持中文（dashboard 用户基本都中文），需要 i18n 时再拆 language 入参。

import sql from "@/lib/db";

export interface Insight {
  id: number;
  insight_type: string;
  text: string;
  emoji: string | null;
  sort_priority: number;
  created_at: Date;
  expires_at: Date;
}

interface InsightDraft {
  insight_type: string;
  text: string;
  emoji: string | null;
  sort_priority: number;
  /** 过期时间（Date 对象，service 会转 ISO） */
  expires_at: Date;
}

/** 当月底 23:59:59，月度统计 insight 用 */
function endOfMonth(): Date {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59);
}
/** N 小时后 */
function hoursFromNow(h: number): Date {
  return new Date(Date.now() + h * 3600_000);
}
/** N 天后 */
function daysFromNow(d: number): Date {
  return new Date(Date.now() + d * 86400_000);
}

// ---------------------------------------------------------------------------
// 各类 insight 的生成器（每个返回 0~1 条 InsightDraft）
// ---------------------------------------------------------------------------

/** 1. 最近 1h 完成的面试 —— "👋 张三 刚刚完成了「办公室主任」面试" */
async function genRecentCompleted(orgId: string): Promise<InsightDraft | null> {
  const rows = await sql<{ name: string | null; email: string | null; interview_name: string | null }[]>`
    SELECT r.name, r.email, i.name AS interview_name
    FROM response r
    JOIN interview i ON i.id = r.interview_id
    WHERE i.organization_id = ${orgId}
      AND r.is_ended = true
      AND r.created_at > NOW() - INTERVAL '1 hour'
    ORDER BY r.created_at DESC
    LIMIT 1
  `;
  if (rows.length === 0) return null;
  const r = rows[0];
  const candidate = (r.name ?? r.email ?? "候选人").trim();
  const interview = (r.interview_name ?? "面试").trim();
  return {
    insight_type: "recent_completed",
    emoji: "👋",
    text: `${candidate} 刚刚完成了「${interview}」面试`,
    sort_priority: 100,
    expires_at: hoursFromNow(1),
  };
}

/** 2. 正在进行中的面试 —— "🎤 李女士 正在「销售岗」面试" */
async function genOngoing(orgId: string): Promise<InsightDraft | null> {
  const rows = await sql<{ name: string | null; email: string | null; interview_name: string | null }[]>`
    SELECT r.name, r.email, i.name AS interview_name
    FROM response r
    JOIN interview i ON i.id = r.interview_id
    WHERE i.organization_id = ${orgId}
      AND r.is_ended = false
      AND r.created_at > NOW() - INTERVAL '30 minutes'
    ORDER BY r.created_at DESC
    LIMIT 1
  `;
  if (rows.length === 0) return null;
  const r = rows[0];
  const candidate = (r.name ?? r.email ?? "候选人").trim();
  const interview = (r.interview_name ?? "面试").trim();
  return {
    insight_type: "ongoing",
    emoji: "🎤",
    text: `${candidate} 正在「${interview}」面试中`,
    sort_priority: 90,
    expires_at: hoursFromNow(1),
  };
}

/** 3. 高分（最近 7 天内 score >= 85）—— "⭐ 王明 在「产品经理」中获得 92 分" */
async function genHighScore(orgId: string): Promise<InsightDraft | null> {
  const rows = await sql<{ name: string | null; email: string | null; interview_name: string | null; score: string | null }[]>`
    SELECT r.name, r.email, i.name AS interview_name, r.analytics->>'overallScore' AS score
    FROM response r
    JOIN interview i ON i.id = r.interview_id
    WHERE i.organization_id = ${orgId}
      AND r.is_ended = true
      AND r.created_at > NOW() - INTERVAL '7 days'
      AND (r.analytics->>'overallScore')::int >= 85
    ORDER BY (r.analytics->>'overallScore')::int DESC, r.created_at DESC
    LIMIT 1
  `;
  if (rows.length === 0) return null;
  const r = rows[0];
  const candidate = (r.name ?? r.email ?? "候选人").trim();
  const interview = (r.interview_name ?? "面试").trim();
  return {
    insight_type: "high_score",
    emoji: "⭐",
    text: `${candidate} 在「${interview}」获得 ${r.score} 分高分`,
    sort_priority: 80,
    expires_at: daysFromNow(1),
  };
}

/** 4. 本月已完成面试数 —— "📊 本月已完成 23 场面试" */
async function genMonthlyCompleted(orgId: string): Promise<InsightDraft | null> {
  const rows = await sql<{ count: string }[]>`
    SELECT COUNT(*) AS count
    FROM response r
    JOIN interview i ON i.id = r.interview_id
    WHERE i.organization_id = ${orgId}
      AND r.is_ended = true
      AND r.created_at >= date_trunc('month', NOW())
  `;
  const n = Number(rows[0]?.count ?? 0);
  if (n === 0) return null;
  return {
    insight_type: "monthly_completed",
    emoji: "📊",
    text: `本月已完成 ${n} 场面试`,
    sort_priority: 60,
    expires_at: endOfMonth(),
  };
}

/** 5. 本月新增简历 —— "📋 本月共筛选 47 份简历" */
async function genMonthlyResumes(orgId: string): Promise<InsightDraft | null> {
  const rows = await sql<{ count: string }[]>`
    SELECT COUNT(*) AS count
    FROM interviewee ie
    JOIN job j ON j.id = ie.job_id
    WHERE j.organization_id = ${orgId}
      AND ie.created_at >= date_trunc('month', NOW())
  `;
  const n = Number(rows[0]?.count ?? 0);
  if (n === 0) return null;
  return {
    insight_type: "monthly_resumes",
    emoji: "📋",
    text: `本月共筛选 ${n} 份简历`,
    sort_priority: 55,
    expires_at: endOfMonth(),
  };
}

/** 6. 本月新增职位 —— "📈 本月新增 5 个职位" */
async function genMonthlyJobs(orgId: string): Promise<InsightDraft | null> {
  const rows = await sql<{ count: string }[]>`
    SELECT COUNT(*) AS count
    FROM job
    WHERE organization_id = ${orgId}
      AND created_at >= date_trunc('month', NOW())
  `;
  const n = Number(rows[0]?.count ?? 0);
  if (n === 0) return null;
  return {
    insight_type: "monthly_jobs",
    emoji: "📈",
    text: `本月新增 ${n} 个职位`,
    sort_priority: 50,
    expires_at: endOfMonth(),
  };
}

/** 7. 待评估面试数（is_viewed=false 且 is_ended=true） */
async function genPendingReview(orgId: string): Promise<InsightDraft | null> {
  const rows = await sql<{ count: string }[]>`
    SELECT COUNT(*) AS count
    FROM response r
    JOIN interview i ON i.id = r.interview_id
    WHERE i.organization_id = ${orgId}
      AND r.is_ended = true
      AND r.is_viewed = false
  `;
  const n = Number(rows[0]?.count ?? 0);
  if (n === 0) return null;
  return {
    insight_type: "pending_review",
    emoji: "📌",
    text: `你有 ${n} 场面试待评估`,
    sort_priority: 95,
    expires_at: hoursFromNow(2),
  };
}

/** 8. 同比趋势（本月 vs 上月） —— "🔥 面试量比上月增长 40%" */
async function genTrend(orgId: string): Promise<InsightDraft | null> {
  const rows = await sql<{ this_month: string; last_month: string }[]>`
    SELECT
      COUNT(*) FILTER (WHERE r.created_at >= date_trunc('month', NOW())) AS this_month,
      COUNT(*) FILTER (WHERE r.created_at >= date_trunc('month', NOW() - INTERVAL '1 month')
                        AND r.created_at <  date_trunc('month', NOW())) AS last_month
    FROM response r
    JOIN interview i ON i.id = r.interview_id
    WHERE i.organization_id = ${orgId}
      AND r.is_ended = true
  `;
  const tm = Number(rows[0]?.this_month ?? 0);
  const lm = Number(rows[0]?.last_month ?? 0);
  if (lm === 0 || tm === 0) return null;
  const pct = Math.round(((tm - lm) / lm) * 100);
  if (pct === 0) return null;
  const isUp = pct > 0;
  return {
    insight_type: "trend",
    emoji: isUp ? "🔥" : "📉",
    text: isUp
      ? `面试量比上月增长 ${pct}%`
      : `面试量比上月下降 ${Math.abs(pct)}%`,
    sort_priority: 40,
    expires_at: daysFromNow(1),
  };
}

/** 9. 累计面试数 —— "🎉 累计已完成 142 场面试" */
async function genAllTime(orgId: string): Promise<InsightDraft | null> {
  const rows = await sql<{ count: string }[]>`
    SELECT COUNT(*) AS count
    FROM response r
    JOIN interview i ON i.id = r.interview_id
    WHERE i.organization_id = ${orgId}
      AND r.is_ended = true
  `;
  const n = Number(rows[0]?.count ?? 0);
  if (n < 10) return null; // 太少不显得"累计"
  return {
    insight_type: "all_time",
    emoji: "🎉",
    text: `累计已完成 ${n} 场面试`,
    sort_priority: 30,
    expires_at: daysFromNow(1),
  };
}

/** 10. 0 数据时的鼓励文案 —— 新组织进来不显空 */
async function genEmptyEncouragement(orgId: string): Promise<InsightDraft | null> {
  const rows = await sql<{ count: string }[]>`
    SELECT COUNT(*) AS count FROM interview WHERE organization_id = ${orgId}
  `;
  const n = Number(rows[0]?.count ?? 0);
  if (n > 0) return null;
  return {
    insight_type: "empty_encouragement",
    emoji: "🚀",
    text: "创建你的第一个面试，开启 AI 招聘体验",
    sort_priority: 100,
    expires_at: daysFromNow(7),
  };
}

// ---------------------------------------------------------------------------
// 整合 + 持久化
// ---------------------------------------------------------------------------

const GENERATORS = [
  genRecentCompleted,
  genOngoing,
  genHighScore,
  genPendingReview,
  genMonthlyCompleted,
  genMonthlyResumes,
  genMonthlyJobs,
  genTrend,
  genAllTime,
  genEmptyEncouragement,
];

/**
 * 为指定 org 重新生成全部 insights：
 *  1. 删除该 org 旧的所有 insight
 *  2. 跑 10 个生成器并行
 *  3. 把 non-null 结果批量 INSERT
 *
 * 不抛错（failure 会被吞掉打 console.warn），让 API 调用方不阻塞用户响应。
 */
export async function generateInsightsForOrg(orgId: string): Promise<void> {
  if (!orgId) return;
  try {
    const drafts = await Promise.all(GENERATORS.map((g) => g(orgId).catch(() => null)));
    const valid = drafts.filter((d): d is InsightDraft => d !== null);

    // 先清空该 org 旧的，再插新的。
    // 不用事务包装：postgres.js 的 sql.begin 类型推断有问题；
    // 即便中间 INSERT 失败该 org 临时少几条 insight 也无伤大雅，下次 lazy 触发会修复。
    await sql`DELETE FROM org_insights WHERE organization_id = ${orgId}`;
    for (const d of valid) {
      await sql`
        INSERT INTO org_insights (
          organization_id, insight_type, text, emoji, sort_priority, expires_at
        ) VALUES (
          ${orgId}, ${d.insight_type}, ${d.text}, ${d.emoji}, ${d.sort_priority}, ${d.expires_at.toISOString()}
        )
      `;
    }
  } catch (err) {
    console.warn("[insights] generateInsightsForOrg failed:", err);
  }
}

/** 拿当前 org 未过期的 insights，按 sort_priority desc + created_at desc 排 */
export async function getActiveInsights(orgId: string): Promise<Insight[]> {
  if (!orgId) return [];
  try {
    const rows = await sql<Insight[]>`
      SELECT id, insight_type, text, emoji, sort_priority, created_at, expires_at
      FROM org_insights
      WHERE organization_id = ${orgId}
        AND expires_at > NOW()
      ORDER BY sort_priority DESC, created_at DESC
      LIMIT 12
    `;
    return rows;
  } catch (err) {
    console.warn("[insights] getActiveInsights failed:", err);
    return [];
  }
}

/** 检查最近一次 insight 生成时间，> 1h 才需要重生成 */
export async function shouldRegenerate(orgId: string): Promise<boolean> {
  if (!orgId) return false;
  try {
    const rows = await sql<{ last: Date | null }[]>`
      SELECT MAX(created_at) AS last FROM org_insights WHERE organization_id = ${orgId}
    `;
    const last = rows[0]?.last;
    if (!last) return true;
    const ageMs = Date.now() - new Date(last).getTime();
    return ageMs > 3600_000;
  } catch {
    return false;
  }
}
