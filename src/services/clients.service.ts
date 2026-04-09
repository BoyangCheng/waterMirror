"use server";

import sql, { cachedQuery, invalidateCache } from "@/lib/db";

const ORG_TTL = 5 * 60_000;  // 5 分钟
const USER_TTL = 5 * 60_000; // 5 分钟

const updateOrganization = async (payload: any, id: string) => {
  try {
    await sql`UPDATE organization SET ${sql(payload)} WHERE id = ${id}`;
    invalidateCache(`org:${id}`);
    return null;
  } catch (error) {
    console.log(error);
    return [];
  }
};

/**
 * 仅按 id 读取组织信息，命中 5 分钟缓存。
 * 与 getOrganizationById 不同：不做 upsert，纯读，可被服务端任意路由复用。
 */
const getCachedOrganizationById = async (
  organization_id: string,
): Promise<{ id: string; name: string | null } | null> => {
  if (!organization_id) return null;
  try {
    return await cachedQuery(
      `org:${organization_id}`,
      async () => {
        const data = await sql`SELECT id, name FROM organization WHERE id = ${organization_id}`;
        return data && data.length > 0 ? (data[0] as { id: string; name: string | null }) : null;
      },
      ORG_TTL,
    );
  } catch (error) {
    console.log(error);
    return null;
  }
};

const getClientById = async (
  id: string,
  email?: string | null,
  organization_id?: string | null,
) => {
  try {
    const data = await sql`SELECT * FROM "user" WHERE id = ${id}`;

    if (!data || (data.length === 0 && email)) {
      await sql`
        INSERT INTO "user" (id, email, organization_id)
        VALUES (${id}, ${email ?? null}, ${organization_id ?? null})
      `;
      return null;
    }

    if (data[0].organization_id !== organization_id) {
      await sql`
        UPDATE "user" SET organization_id = ${organization_id ?? null}
        WHERE id = ${id}
      `;
      return data[0];
    }

    return data ? data[0] : null;
  } catch (error) {
    console.log(error);
    return [];
  }
};

const getOrganizationById = async (organization_id?: string, organization_name?: string) => {
  try {
    const data = await sql`SELECT * FROM organization WHERE id = ${organization_id ?? null}`;

    if (!data || data.length === 0) {
      await sql`
        INSERT INTO organization (id, name)
        VALUES (${organization_id ?? null}, ${organization_name ?? null})
      `;
      return null;
    }

    if (organization_name && data[0].name !== organization_name) {
      await sql`
        UPDATE organization SET name = ${organization_name}
        WHERE id = ${organization_id ?? null}
      `;
      return data[0];
    }

    return data ? data[0] : null;
  } catch (error) {
    console.log(error);
    return null;
  }
};

const updateUser = async (_id: string, _payload: { name?: string; phone?: string }) => {
  // name/phone columns not yet migrated — no-op until migration is run
  return true;
};

const getUserById = async (id: string) => {
  try {
    return await cachedQuery(
      `user:${id}`,
      async () => {
        const data = await sql`SELECT * FROM "user" WHERE id = ${id}`;
        return data ? data[0] : null;
      },
      USER_TTL,
    );
  } catch (error) {
    console.log(error);
    return null;
  }
};

const getUsersByOrgId = async (orgId: string) => {
  try {
    return await cachedQuery(
      `users:${orgId}`,
      async () => {
        const data = await sql`SELECT id, email FROM "user" WHERE organization_id = ${orgId}`;
        return data || [];
      },
      USER_TTL,
    );
  } catch (error) {
    console.log(error);
    return [];
  }
};

const joinOrganization = async (userId: string, orgId: string) => {
  try {
    const org = await sql`SELECT id FROM organization WHERE id = ${orgId}`;
    if (!org || org.length === 0) return { success: false, error: "Organization not found" };
    await sql`UPDATE "user" SET organization_id = ${orgId} WHERE id = ${userId}`;
    return { success: true };
  } catch (error) {
    console.log(error);
    return { success: false, error: "Failed to join organization" };
  }
};

const createOrganization = async (name: string) => {
  try {
    const [org] = await sql`
      INSERT INTO organization (id, name)
      VALUES (gen_random_uuid()::TEXT, ${name})
      RETURNING id, name
    `;
    return org;
  } catch (error) {
    console.log(error);
    return null;
  }
};

export {
  updateOrganization,
  getClientById,
  getOrganizationById,
  getCachedOrganizationById,
  updateUser,
  getUserById,
  getUsersByOrgId,
  joinOrganization,
  createOrganization,
};
