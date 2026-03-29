import { NextResponse } from "next/server";

export async function GET() {
  const authUrl = new URL(process.env.NEXT_PUBLIC_IDAAS_AUTHORIZATION_ENDPOINT!);
  authUrl.searchParams.set("client_id", process.env.IDAAS_CLIENT_ID!);
  authUrl.searchParams.set("redirect_uri", process.env.IDAAS_REDIRECT_URI!);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("scope", "openid profile email phone");

  return NextResponse.redirect(authUrl.toString());
}
