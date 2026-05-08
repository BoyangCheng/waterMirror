import { auth } from "@/lib/auth";
import { getOrganizationById, getUserById } from "@/services/clients.service";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  if (!session) {
    return NextResponse.json({});
  }

  // 组织信息全部从 DB 实拉（JWT 不再带 org_name/org_image，避免 cookie 膨胀）。
  let orgId = session.orgId;
  let orgName = "";
  let orgImage = "";
  let name: string | null = null;
  let phone: string | null = null;

  try {
    const user = await getUserById(session.userId);
    if (user) {
      name = user.name ?? null;
      phone = user.phone ?? null;
      const dbOrgId = user.organization_id ?? session.orgId;
      if (dbOrgId) {
        orgId = dbOrgId;
        const org = await getOrganizationById(dbOrgId);
        if (org) {
          orgName = (org as { name?: string }).name ?? "";
          orgImage = (org as { image_url?: string }).image_url ?? "";
        }
      }
    }
  } catch {
    // DB 读失败时返回空字符串，前端展示降级为占位符
  }

  return NextResponse.json({
    userId: session.userId,
    orgId,
    email: session.email,
    name,
    phone,
    orgName,
    orgImage,
  });
}
