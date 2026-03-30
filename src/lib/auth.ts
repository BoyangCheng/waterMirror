import { jwtVerify } from "jose";
import { cookies } from "next/headers";

export interface AuthSession {
  userId: string;
  orgId: string;
  email: string;
  orgName: string;
  orgImage: string;
}

// Server Component / API Route 中使用（替代 Clerk 的 auth()）
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
      orgName: (payload.org_name as string) ?? "",
      orgImage: (payload.org_image as string) ?? "",
    };
  } catch {
    return null;
  }
}
