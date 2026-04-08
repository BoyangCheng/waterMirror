import { auth } from "@/lib/auth";
import { getOrganizationById, getUserById } from "@/services/clients.service";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  if (!session) {
    return NextResponse.json({});
  }

  // 获取最新的 org 信息（JWT 里的 org_name 可能在用户首次登录后还是空的，
  // 用户在 OrgManagementModal 里创建/更新组织后，需从 DB 取最新值，
  // 否则分享面试信息里的【组织名】会一直是空的）。
  let orgId = session.orgId;
  let orgName = session.orgName;
  let orgImage = session.orgImage;

  try {
    const user = await getUserById(session.userId);
    const dbOrgId = (user as { organization_id?: string } | null)?.organization_id ?? session.orgId;
    if (dbOrgId) {
      orgId = dbOrgId;
      const org = await getOrganizationById(dbOrgId);
      if (org) {
        orgName = (org as { name?: string }).name ?? orgName;
        orgImage = (org as { image_url?: string }).image_url ?? orgImage;
      }
    }
  } catch {
    // 出错时回退到 JWT 里的值
  }

  return NextResponse.json({
    userId: session.userId,
    orgId,
    email: session.email,
    orgName,
    orgImage,
  });
}
