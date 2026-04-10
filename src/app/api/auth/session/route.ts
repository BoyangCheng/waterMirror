import { auth } from "@/lib/auth";
import { getOrganizationById, getUserById } from "@/services/clients.service";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  if (!session) {
    return NextResponse.json({});
  }

  // 获取最新的 org / user 信息（JWT 里的字段可能在首次登录后还是空的，
  // 用户在 OrgManagementModal 里更新过 name / phone / 组织后需从 DB 取最新）。
  let orgId = session.orgId;
  let orgName = session.orgName;
  let orgImage = session.orgImage;
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
          orgName = (org as { name?: string }).name ?? orgName;
          orgImage = (org as { image_url?: string }).image_url ?? orgImage;
        }
      }
    }
  } catch {
    // 出错时回退到 JWT 里的值
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
