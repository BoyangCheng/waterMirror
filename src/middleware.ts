import { jwtVerify } from "jose";
import { NextRequest, NextResponse } from "next/server";

// 公开路由（无需认证）
const publicRoutes = [
  "/sign-in",
  "/sign-up",
  "/api/auth/callback",
  "/api/auth/login",
  "/api/auth/logout",
  "/api/auth/session",
  "/api/auth/refresh",
  "/api/auth/dev-login",
];

const publicPrefixes = ["/call/", "/interview/", "/join/"];

// 反向代理后面 request.url 的 host 可能是上游（127.0.0.1:3000），
// 用 NEXT_PUBLIC_SITE_URL 作为 base 保证重定向指向公网域名。
function buildRedirectUrl(path: string, request: NextRequest): URL {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || request.url;
  return new URL(path, baseUrl);
}

export default async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 公开路由直接放行
  if (publicRoutes.includes(pathname)) return NextResponse.next();
  if (publicPrefixes.some((p) => pathname.startsWith(p))) return NextResponse.next();

  // 只保护 /dashboard 和 /call 路由
  const isProtected =
    pathname.startsWith("/dashboard") || pathname.startsWith("/call");

  if (!isProtected) return NextResponse.next();

  // 验证 JWT token
  const token = request.cookies.get("idaas_access_token")?.value;
  if (!token) {
    return NextResponse.redirect(buildRedirectUrl("/sign-in", request));
  }

  try {
    const secret = new TextEncoder().encode(process.env.AUTH_SECRET!);
    await jwtVerify(token, secret);
    return NextResponse.next();
  } catch {
    return NextResponse.redirect(buildRedirectUrl("/sign-in", request));
  }
}

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
