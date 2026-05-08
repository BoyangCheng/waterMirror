import { jwtVerify } from "jose";
import { cookies } from "next/headers";

export interface AuthSession {
  userId: string;
  orgId: string;
  email: string;
}

// Server Component / API Route 中使用（替代 Clerk 的 auth()）
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
    return {
      userId: payload.sub as string,
      orgId: (payload.org_id as string) ?? "",
      email: (payload.email as string) ?? "",
    };
  } catch {
    return null;
  }
}
