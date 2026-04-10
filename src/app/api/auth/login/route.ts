import { NextRequest, NextResponse } from "next/server";

// 把调用方想要的落地路径塞进 OIDC `state`，Authing 会原样回传，
// callback 里再解出来做跳转 / 识别邀请。
function encodeState(data: { next?: string; invite?: string }): string {
  return Buffer.from(JSON.stringify(data)).toString("base64url");
}

// 仅允许相对路径且必须以单个 `/` 开头，防开放重定向。
function sanitizeNext(raw: string | null): string | null {
  if (!raw) return null;
  if (!raw.startsWith("/") || raw.startsWith("//")) return null;
  return raw;
}

// `/join/<orgId>` 视为邀请，把 orgId 单独抽出来方便 callback 直接识别。
function parseInviteOrgId(next: string | null): string | null {
  if (!next) return null;
  const match = next.match(/^\/join\/([^/?#]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

export async function GET(request: NextRequest) {
  const next = sanitizeNext(request.nextUrl.searchParams.get("next"));
  const invite = parseInviteOrgId(next);

  const authUrl = new URL(`${process.env.NEXT_PUBLIC_AUTHING_APP_HOST}/oidc/auth`);
  authUrl.searchParams.set("client_id", process.env.AUTHING_APP_ID!);
  authUrl.searchParams.set("redirect_uri", process.env.AUTHING_REDIRECT_URI!);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("scope", "openid profile email phone");

  if (next || invite) {
    authUrl.searchParams.set(
      "state",
      encodeState({
        next: next ?? undefined,
        invite: invite ?? undefined,
      }),
    );
  }

  return NextResponse.redirect(authUrl.toString());
}
