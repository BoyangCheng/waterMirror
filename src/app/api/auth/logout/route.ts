import { NextRequest, NextResponse } from "next/server";

// 真正的登出必须做两件事：
//   1. 清掉本站的 idaas_access_token cookie
//   2. 调 Authing 的 OIDC end_session，把 SSO 那边的 session 也清掉
// 否则下一次访问 /sign-in 会被 Authing 直接静默重定向回来，看起来"退出失败"。
//
// 注意：post_logout_redirect_uri 必须在 Authing 应用后台白名单里登记，
// 否则 Authing 会拒绝。env 里通过 AUTHING_LOGOUT_REDIRECT_URI 指定，
// 不配置则降级为 NEXT_PUBLIC_SITE_URL + /sign-in。
function buildLogoutTarget(request: NextRequest): string {
  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL || new URL(request.url).origin;
  const postLogoutRedirect =
    process.env.AUTHING_LOGOUT_REDIRECT_URI || `${siteUrl}/sign-in`;

  const authingHost = process.env.NEXT_PUBLIC_AUTHING_APP_HOST;
  if (!authingHost) {
    // 没配 Authing host（dev 或没启用 SSO）—— 退化为只跳本站登录页
    return postLogoutRedirect;
  }

  const endSession = new URL(`${authingHost}/oidc/session/end`);
  endSession.searchParams.set("post_logout_redirect_uri", postLogoutRedirect);
  if (process.env.AUTHING_APP_ID) {
    endSession.searchParams.set("client_id", process.env.AUTHING_APP_ID);
  }
  return endSession.toString();
}

function clearCookie(response: NextResponse): NextResponse {
  // 关键：name/path/domain 必须和当初 set 时一致才清得掉。
  // sameSite/secure 不参与匹配，但显式写一致避免歧义。
  response.cookies.set("idaas_access_token", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 0,
    path: "/",
  });
  return response;
}

// GET：浏览器直接 navigate 过来用的入口，清 cookie 后 302 到 Authing end_session
export async function GET(request: NextRequest) {
  const target = buildLogoutTarget(request);
  return clearCookie(NextResponse.redirect(target));
}

// POST：保留给老调用方（fetch 调用）使用，只清 cookie 返回 ok。
// 客户端拿到 ok 后自己 navigate 到 /api/auth/logout (GET) 或 /sign-in。
export async function POST() {
  return clearCookie(NextResponse.json({ ok: true }));
}
