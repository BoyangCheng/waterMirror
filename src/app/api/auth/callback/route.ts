import { SignJWT } from "jose";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");

  if (!code) {
    return NextResponse.redirect(new URL("/sign-in", request.url));
  }

  // 用 code 换 token
  const tokenRes = await fetch(`${process.env.IDAAS_ISSUER}token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      client_id: process.env.IDAAS_CLIENT_ID!,
      client_secret: process.env.IDAAS_CLIENT_SECRET!,
      redirect_uri: process.env.IDAAS_REDIRECT_URI!,
    }),
  });

  if (!tokenRes.ok) {
    return NextResponse.redirect(new URL("/sign-in", request.url));
  }

  const tokens = await tokenRes.json();

  // 签发内部 JWT
  const secret = new TextEncoder().encode(process.env.AUTH_SECRET!);
  const internalToken = await new SignJWT({
    sub: tokens.user_id ?? tokens.sub,
    org_id: tokens.org_id ?? "default",
    email: tokens.email ?? "",
    org_name: tokens.org_name ?? "",
    org_image: tokens.org_image ?? "",
  })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("7d")
    .sign(secret);

  const response = NextResponse.redirect(new URL("/dashboard", request.url));
  response.cookies.set("idaas_access_token", internalToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 7,
    path: "/",
  });

  return response;
}
