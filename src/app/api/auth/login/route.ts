import { NextResponse } from "next/server";

export async function GET() {
  const authUrl = new URL(`${process.env.NEXT_PUBLIC_AUTHING_APP_HOST}/oidc/auth`);
  authUrl.searchParams.set("client_id", process.env.AUTHING_APP_ID!);
  authUrl.searchParams.set("redirect_uri", process.env.AUTHING_REDIRECT_URI!);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("scope", "openid profile email phone");

  return NextResponse.redirect(authUrl.toString());
}
