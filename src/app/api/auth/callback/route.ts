import sql from "@/lib/db";
import { SignJWT } from "jose";
import { NextRequest, NextResponse } from "next/server";

// 反向代理后面 request.url 的 host 可能是上游（127.0.0.1:3000），
// 用 NEXT_PUBLIC_SITE_URL 作为 base 保证重定向指向公网域名。
function baseUrlOf(request: NextRequest): string {
  return process.env.NEXT_PUBLIC_SITE_URL || request.url;
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
    return NextResponse.redirect(new URL("/sign-in", baseUrl));
  }

  try {
    // 用 code 换 token
    const tokenRes = await fetch(`${process.env.AUTHING_ISSUER}/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        client_id: process.env.AUTHING_APP_ID!,
        client_secret: process.env.AUTHING_APP_SECRET!,
        redirect_uri: process.env.AUTHING_REDIRECT_URI!,
      }),
    });

    if (!tokenRes.ok) {
      console.error("[auth/callback] token exchange failed:", tokenRes.status, await tokenRes.text().catch(() => ""));
      return NextResponse.redirect(new URL("/sign-in", baseUrl));
    }

    const tokens = await tokenRes.json();

    // 获取用户信息
    const userInfoRes = await fetch(`${process.env.AUTHING_ISSUER}/me`, {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    const userInfo = userInfoRes.ok ? await userInfoRes.json() : {};

    const userId = (userInfo.sub ?? tokens.sub) as string;
    const email = ((userInfo.email as string) ?? "").trim();
    const phone = ((userInfo.phone_number as string) ?? "").trim();
    const userName = ((userInfo.name || userInfo.nickname || userInfo.preferred_username) as string ?? "").trim();
    const authingOrgId = ((userInfo.org_id as string) ?? "").trim();
    const authingOrgName = ((userInfo.org_name as string) ?? "").trim();
    const orgImage = ((userInfo.picture as string) ?? "").trim();

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

    // 邀请命中时，JWT 里的 org_name / org_image 从 DB 实拉一次，
    // 避免跳完 dashboard 还显示 Authing 自带的那个 org 名字。
    let jwtOrgName = authingOrgName;
    let jwtOrgImage = orgImage;
    if (inviteOrgId) {
      try {
        const rows = await sql<
          { name: string | null; image_url: string | null }[]
        >`
          SELECT name, image_url FROM organization WHERE id = ${inviteOrgId}
        `;
        if (rows && rows.length > 0) {
          jwtOrgName = rows[0].name ?? "";
          jwtOrgImage = rows[0].image_url ?? "";
        }
      } catch {
        /* 静默回退 */
      }
    }

    // 签发内部 JWT
    const secret = new TextEncoder().encode(process.env.AUTH_SECRET!);
    const internalToken = await new SignJWT({
      sub: userId,
      org_id: finalOrgId,
      email,
      org_name: jwtOrgName,
      org_image: jwtOrgImage,
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

    const response = NextResponse.redirect(new URL(redirectPath, baseUrl));
    response.cookies.set("idaas_access_token", internalToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24 * 7,
      path: "/",
    });

    return response;
  } catch (err) {
    console.error("[auth/callback] unhandled error:", err);
    return NextResponse.redirect(new URL("/sign-in", baseUrl));
  }
}
