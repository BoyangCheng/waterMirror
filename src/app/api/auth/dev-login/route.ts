import { SignJWT } from "jose";
import { NextRequest, NextResponse } from "next/server";

// 仅在非 production 环境可用
// 用法：访问 /api/auth/dev-login 直接获得登录态，绕过 Authing
export async function GET(request: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not available in production" }, { status: 403 });
  }

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

  // 从 env 读取 dev 用户信息，方便自定义；否则使用内置占位值
  const userId = process.env.DEV_AUTH_USER_ID || "dev-user-local";
  const orgId = process.env.DEV_AUTH_ORG_ID || "default";
  const email = process.env.DEV_AUTH_EMAIL || "dev@localhost";
  const orgName = process.env.DEV_AUTH_ORG_NAME || "Dev Org";

  const secret = new TextEncoder().encode(process.env.AUTH_SECRET!);
  const token = await new SignJWT({
    sub: userId,
    org_id: orgId,
    email,
    org_name: orgName,
    org_image: "",
  })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("7d")
    .sign(secret);

  // 跳转目标：支持 ?next= 参数
  const next = request.nextUrl.searchParams.get("next");
  const safeNext =
    typeof next === "string" && next.startsWith("/") && !next.startsWith("//")
      ? next
      : "/dashboard";

  const response = NextResponse.redirect(new URL(safeNext, baseUrl));
  response.cookies.set("idaas_access_token", token, {
    httpOnly: true,
    secure: false, // dev 下允许 http
    maxAge: 60 * 60 * 24 * 7,
    path: "/",
  });

  return response;
}
