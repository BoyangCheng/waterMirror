import { auth } from "@/lib/auth";
import { getUserById } from "@/services/clients.service";
import { SignJWT } from "jose";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.redirect(new URL("/sign-in", request.url));
  }

  // 用户可能换了组织，从 DB 拿最新 org_id；name/image 不进 JWT，
  // 前端走 /api/auth/session 从 DB 实时取。
  const user = await getUserById(session.userId);
  const orgId = user?.organization_id ?? session.orgId;

  const secret = new TextEncoder().encode(process.env.AUTH_SECRET!);
  const internalToken = await new SignJWT({
    sub: session.userId,
    org_id: orgId ?? "",
    email: session.email,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("7d")
    .sign(secret);

  const redirectTo = request.nextUrl.searchParams.get("redirectTo") ?? "/dashboard";
  // 反向代理后面 request.url 里的 host 是上游（127.0.0.1:3000），
  // 用 NEXT_PUBLIC_SITE_URL 作为 base 保证重定向到公网域名。
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || request.url;
  const response = NextResponse.redirect(new URL(redirectTo, baseUrl));
  response.cookies.set("idaas_access_token", internalToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 7,
    path: "/",
  });

  return response;
}
