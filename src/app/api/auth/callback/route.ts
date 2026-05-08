import sql from "@/lib/db";
import { SignJWT } from "jose";
import { NextRequest, NextResponse } from "next/server";

// 反向代理后面 request.url 的 host 可能是上游（127.0.0.1:3000），
// 用 NEXT_PUBLIC_SITE_URL 作为 base 保证重定向指向公网域名。
function baseUrlOf(request: NextRequest): string {
  return process.env.NEXT_PUBLIC_SITE_URL || request.url;
}

// 给 Authing 的外网 fetch 加一个硬超时，否则 Authing 慢会把整个 route hang 死，
// nginx 收不到上游响应就 502。出错时 throw，由外层 try/catch 兜底重定向。
async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs = 8000,
): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}


function isSafeNext(next: unknown): next is string {
  return (
    typeof next === "string" &&
    next.startsWith("/") &&
    !next.startsWith("//")
  );
}

function decodeState(
  state: string | null,
): { next?: string; invite?: string } {
  if (!state) return {};
  try {
    const json = Buffer.from(state, "base64url").toString("utf8");
    const parsed = JSON.parse(json);
    return typeof parsed === "object" && parsed ? parsed : {};
  } catch {
    return {};
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = decodeState(searchParams.get("state"));
  const baseUrl = baseUrlOf(request);

  if (!code) {
    console.warn("[auth/callback] no code in querystring, redirecting to /sign-in");
    return NextResponse.redirect(new URL("/sign-in", baseUrl));
  }

  // 早早校验关键 env，缺失就直接重定向并打日志，避免后面 fetch 拿空字符串去请求
  const issuer = process.env.AUTHING_ISSUER;
  const appId = process.env.AUTHING_APP_ID;
  const appSecret = process.env.AUTHING_APP_SECRET;
  const redirectUri = process.env.AUTHING_REDIRECT_URI;
  const authSecret = process.env.AUTH_SECRET;
  const missingEnv = [
    !issuer && "AUTHING_ISSUER",
    !appId && "AUTHING_APP_ID",
    !appSecret && "AUTHING_APP_SECRET",
    !redirectUri && "AUTHING_REDIRECT_URI",
    !authSecret && "AUTH_SECRET",
  ].filter(Boolean);
  if (missingEnv.length > 0) {
    console.error("[auth/callback] missing env vars:", missingEnv.join(", "));
    return NextResponse.redirect(new URL("/sign-in?err=server_misconfig", baseUrl));
  }

  try {
    // 用 code 换 token（带 8s 硬超时）
    const tokenRes = await fetchWithTimeout(`${issuer}/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        client_id: appId!,
        client_secret: appSecret!,
        redirect_uri: redirectUri!,
      }),
    });

    if (!tokenRes.ok) {
      const body = await tokenRes.text().catch(() => "");
      console.error("[auth/callback] token exchange failed:", tokenRes.status, body.slice(0, 500));
      return NextResponse.redirect(new URL("/sign-in?err=token_exchange", baseUrl));
    }

    const tokens = await tokenRes.json();

    // 获取用户信息（带 8s 硬超时）
    let userInfo: any = {};
    try {
      const userInfoRes = await fetchWithTimeout(`${issuer}/me`, {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      });
      userInfo = userInfoRes.ok ? await userInfoRes.json() : {};
      if (!userInfoRes.ok) {
        console.warn("[auth/callback] /me returned", userInfoRes.status);
      }
    } catch (err) {
      // /me 拿不到不阻断登录，至少 sub 在 token 里
      console.warn("[auth/callback] /me fetch failed, falling back to token sub:", err);
    }

    const userId = (userInfo.sub ?? tokens.sub) as string;
    const email = ((userInfo.email as string) ?? "").trim();
    const phone = ((userInfo.phone_number as string) ?? "").trim();
    const userName = ((userInfo.name || userInfo.nickname || userInfo.preferred_username) as string ?? "").trim();
    const authingOrgId = ((userInfo.org_id as string) ?? "").trim();
    const authingOrgName = ((userInfo.org_name as string) ?? "").trim();
    // userInfo.picture 不再用——Authing 头像不进 JWT，前端从 /api/auth/session 拿 DB 的 image_url

    if (!userId) {
      console.error("[auth/callback] no userId from token/userInfo");
      return NextResponse.redirect(new URL("/sign-in", baseUrl));
    }

    // 校验 state.invite 对应的 org 真实存在（防伪造）
    let inviteOrgId: string | null = null;
    if (state.invite) {
      try {
        const rows = await sql<{ id: string }[]>`
          SELECT id FROM organization WHERE id = ${state.invite}
        `;
        if (rows && rows.length > 0) {
          inviteOrgId = state.invite;
        }
      } catch (err) {
        console.error("Failed to verify invite org", err);
      }
    }

    // 决定最终 org_id：邀请 > Authing 自带 > default
    const finalOrgId = inviteOrgId || authingOrgId || "default";

    // ── Upsert organization & user ───────────────────────────────────
    // 不再依赖前端 ClientProvider 的 lazy upsert：callback 一次写死。
    try {
      // Authing 自带的 org 也要存在，避免后续 JWT 里还带着它时产生空悬 FK
      if (authingOrgId) {
        await sql`
          INSERT INTO organization (id, name)
          VALUES (${authingOrgId}, ${authingOrgName || null})
          ON CONFLICT (id) DO NOTHING
        `;
      }
      // 兜底 default org
      if (finalOrgId === "default") {
        await sql`
          INSERT INTO organization (id, name)
          VALUES ('default', 'default')
          ON CONFLICT (id) DO NOTHING
        `;
      }
      // Upsert user。
      // - 邀请流：强制覆盖 organization_id（邀请赢过一切）
      // - 普通登录：COALESCE 保留已有 org，只在用户无 org 或 org 为 'default' 时才更新
      if (inviteOrgId) {
        await sql`
          INSERT INTO "user" (id, email, name, phone, organization_id)
          VALUES (${userId}, ${email || null}, ${userName || null}, ${phone || null}, ${inviteOrgId})
          ON CONFLICT (id) DO UPDATE SET
            email = COALESCE(EXCLUDED.email, "user".email),
            name = COALESCE(EXCLUDED.name, "user".name),
            phone = COALESCE(EXCLUDED.phone, "user".phone),
            organization_id = EXCLUDED.organization_id
        `;
      } else {
        await sql`
          INSERT INTO "user" (id, email, name, phone, organization_id)
          VALUES (${userId}, ${email || null}, ${userName || null}, ${phone || null}, ${finalOrgId})
          ON CONFLICT (id) DO UPDATE SET
            email = COALESCE(EXCLUDED.email, "user".email),
            name = COALESCE(EXCLUDED.name, "user".name),
            phone = COALESCE(EXCLUDED.phone, "user".phone),
            organization_id = COALESCE(NULLIF("user".organization_id, 'default'), EXCLUDED.organization_id)
        `;
      }
    } catch (err) {
      // 写库失败不阻断登录，但必须留痕——后续排障能看到。
      console.error("Failed to upsert user/org in OIDC callback", err);
    }

    // 签发内部 JWT。
    // 注意：故意不在 JWT 里塞 org_name / org_image：
    //   1. 前端只通过 /api/auth/session 拿组织信息，那里总会从 DB 重读 name/image_url
    //   2. image_url 可能是用户上传的 base64 data URL，几十 KB 撑爆 nginx 的
    //      proxy_buffer_size，Set-Cookie 头超限就直接 502（之前邀请登录炸的根因）
    //   3. JWT 越精简越安全，多余字段没必要往里塞
    const secret = new TextEncoder().encode(process.env.AUTH_SECRET!);
    const internalToken = await new SignJWT({
      sub: userId,
      org_id: finalOrgId,
      email,
    })
      .setProtectedHeader({ alg: "HS256" })
      .setExpirationTime("7d")
      .sign(secret);

    // 落地跳转：
    // - 邀请命中 → 直接去 dashboard（/join 那一轮已经在这里闭环）
    // - 否则按 state.next（已经过白名单）
    // - 否则默认 dashboard
    const redirectPath = inviteOrgId
      ? "/dashboard"
      : isSafeNext(state.next)
        ? state.next
        : "/dashboard";

    // JWT 现在只有 sub/org_id/email/iat/exp，正常 <500 字节。
    // 如果异常超过 1KB，说明 email 或 org_id 出现了反常长度——打日志告警。
    if (internalToken.length > 1000) {
      console.warn(
        `[auth/callback] JWT abnormally large (${internalToken.length} bytes), ` +
          `org_id=${finalOrgId}, email_len=${email.length}`,
      );
    }

    const response = NextResponse.redirect(new URL(redirectPath, baseUrl));
    response.cookies.set("idaas_access_token", internalToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7,
      path: "/",
    });

    return response;
  } catch (err) {
    // 把堆栈信息全部打出来，方便从容器日志定位 502 的真正源头
    const message = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
    const stack = err instanceof Error ? err.stack : "";
    console.error("[auth/callback] unhandled error:", message, "\n", stack);
    return NextResponse.redirect(new URL("/sign-in?err=callback_failed", baseUrl));
  }
}
