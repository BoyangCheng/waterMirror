import { jwtVerify } from "jose";
import { cookies } from "next/headers";
import sql from "./db";

export interface AuthSession {
  userId: string;
  orgId: string;
  email: string;
}

// Server Component / API Route 中使用（替代 Clerk 的 auth()）
//
// orgId 来源：每次现查 user 表的 organization_id，**不信 JWT 里的 org_id**。
//   - 历史：JWT 里 org_id 在 callback 里写的是 inviteOrgId || authingOrgId || "default"
//   - 但 Authing 不返回 org_id claim，多数用户 JWT 里都是 "default"
//   - 而 user 表 organization_id 一直是真实 org（COALESCE 保护过）
//   - 这就出现 split-brain：前端展示用真实 org（/api/auth/session 现查 DB），
//     后端 API 全部用 JWT 的 "default" → 数据写到错的 org、ticker / 通知错位
//   - 修复方案：auth() 直接从 DB 拉真实 org_id，每个请求多 1 次 SQL（~5ms 可忽略）
//
// 注意：不再从 JWT 里取 org_name/org_image —— 它们曾经是 JWT 体积膨胀的源头
// （base64 头像让 Set-Cookie 撑爆 nginx proxy_buffer_size 触发 502）。
// 组织信息统一由 /api/auth/session 路由从 DB 实时拉取。
export async function auth(): Promise<AuthSession | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get("idaas_access_token")?.value;
  if (!token) return null;

  try {
    const secret = new TextEncoder().encode(process.env.AUTH_SECRET!);
    const { payload } = await jwtVerify(token, secret);
    const userId = payload.sub as string;
    if (!userId) return null;

    // 现查 user.organization_id —— DB 是 org 的权威源
    let orgId = (payload.org_id as string) ?? "";
    try {
      const rows = await sql<{ organization_id: string | null }[]>`
        SELECT organization_id FROM "user" WHERE id = ${userId} LIMIT 1
      `;
      const dbOrgId = rows[0]?.organization_id;
      if (dbOrgId) orgId = dbOrgId;
    } catch {
      // DB 失败时回退到 JWT 里的 org_id —— 退而求其次但不阻塞鉴权
    }

    return {
      userId,
      orgId,
      email: (payload.email as string) ?? "",
    };
  } catch {
    return null;
  }
}
