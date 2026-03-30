import { auth } from "@/lib/auth";
import { getUserById, getOrganizationById } from "@/services/clients.service";
import { SignJWT } from "jose";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.redirect(new URL("/sign-in", request.url));
  }

  // Fetch latest org from DB (user may have changed org)
  const user = await getUserById(session.userId);
  const orgId = user?.organization_id ?? session.orgId;
  const org = orgId ? await getOrganizationById(orgId) : null;

  const secret = new TextEncoder().encode(process.env.AUTH_SECRET!);
  const internalToken = await new SignJWT({
    sub: session.userId,
    org_id: orgId ?? "",
    email: session.email,
    org_name: org?.name ?? "",
    org_image: org?.image_url ?? "",
  })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("7d")
    .sign(secret);

  const redirectTo = request.nextUrl.searchParams.get("redirectTo") ?? "/dashboard";
  const response = NextResponse.redirect(new URL(redirectTo, request.url));
  response.cookies.set("idaas_access_token", internalToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 7,
    path: "/",
  });

  return response;
}
