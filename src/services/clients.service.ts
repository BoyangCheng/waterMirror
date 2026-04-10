"use server";

import sql, { cachedQuery, invalidateCache } from "@/lib/db";
import type { Organization } from "@/types/organization";
import type { User } from "@/types/user";

const ORG_TTL = 5 * 60_000;  // 5 分钟
const USER_TTL = 5 * 60_000; // 5 分钟

const updateOrganization = async (payload: any, id: string): Promise<null> => {
  try {
    await sql`UPDATE organization SET ${sql(payload)} WHERE id = ${id}`;
    invalidateCache(`org:${id}`);
    return null;
  } catch (error) {
    console.log(error);
    return null;
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
    return await cachedQuery<{ id: string; name: string | null } | null>(
      `org:${organization_id}`,
      async () => {
        const data = await sql<{ id: string; name: string | null }[]>`SELECT id, name FROM organization WHERE id = ${organization_id}`;
        return data && data.length > 0 ? data[0] : null;
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
): Promise<User | null> => {
  try {
    // userId 是唯一锚点 —— 只要 session/token 里有 id 就写一行，email 可空。
    // 已存在时用 COALESCE 兜住：Authing 后来补上的字段会写入，但不会把
    // 现有的非空值清掉（例如用户手动改过的 name/phone）。
    await sql`
      INSERT INTO "user" (id, email, organization_id)
      VALUES (${id}, ${email || null}, ${organization_id || null})
      ON CONFLICT (id) DO UPDATE SET
        email = COALESCE(EXCLUDED.email, "user".email),
        organization_id = COALESCE(EXCLUDED.organization_id, "user".organization_id)
    `;
    invalidateCache(`user:${id}`);

    const data = await sql<User[]>`SELECT * FROM "user" WHERE id = ${id}`;
    return data && data.length > 0 ? data[0] : null;
  } catch (error) {
    console.log(error);
    return null;
  }
};

const getOrganizationById = async (
  organization_id?: string,
  organization_name?: string,
): Promise<Organization | null> => {
  try {
    const data = await sql<Organization[]>`SELECT * FROM organization WHERE id = ${organization_id ?? null}`;

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

    return data && data.length > 0 ? data[0] : null;
  } catch (error) {
    console.log(error);
    return null;
  }
};

const updateUser = async (
  id: string,
  payload: { name?: string | null; phone?: string | null },
): Promise<boolean> => {
  try {
    // 允许显式把 name/phone 清成 null；只把明确传入的字段写进去，
    // 未传入的字段不会被 postgres.js 的 sql(payload) helper 序列化。
    const cleaned: Record<string, string | null> = {};
    if ("name" in payload) cleaned.name = payload.name ?? null;
    if ("phone" in payload) cleaned.phone = payload.phone ?? null;
    if (Object.keys(cleaned).length === 0) return true;

    await sql`UPDATE "user" SET ${sql(cleaned)} WHERE id = ${id}`;
    invalidateCache(`user:${id}`);
    return true;
  } catch (error) {
    console.log(error);
    return false;
  }
};

const getUserById = async (id: string): Promise<User | null> => {
  try {
    return await cachedQuery<User | null>(
      `user:${id}`,
      async () => {
        const data = await sql<User[]>`SELECT * FROM "user" WHERE id = ${id}`;
        return data && data.length > 0 ? data[0] : null;
      },
      USER_TTL,
    );
  } catch (error) {
    console.log(error);
    return null;
  }
};

const getUsersByOrgId = async (
  orgId: string,
): Promise<
  { id: string; email: string | null; name: string | null; phone: string | null }[]
> => {
  try {
    return await cachedQuery(
      `users:${orgId}`,
      async () => {
        const data = await sql<
          { id: string; email: string | null; name: string | null; phone: string | null }[]
        >`SELECT id, email, name, phone FROM "user" WHERE organization_id = ${orgId}`;
        return data ? Array.from(data) : [];
      },
      USER_TTL,
    );
  } catch (error) {
    console.log(error);
    return [];
  }
};

const joinOrganization = async (
  userId: string,
  orgId: string,
): Promise<{ success: true } | { success: false; error: string }> => {
  try {
    const org = await sql`SELECT id FROM organization WHERE id = ${orgId}`;
    if (!org || org.length === 0)
      return { success: false, error: "Organization not found" };

    // 用 upsert 而不是 UPDATE —— 老逻辑碰到 DB 里还没有该用户行（比如邀请流
    // 第一次登录、或者 lazy upsert 从来没跑过）时，UPDATE 会静默影响 0 行
    // 却返回 success，导致用户永远加入不进组织。
    await sql`
      INSERT INTO "user" (id, organization_id)
      VALUES (${userId}, ${orgId})
      ON CONFLICT (id) DO UPDATE SET organization_id = EXCLUDED.organization_id
    `;
    invalidateCache(`user:${userId}`);
    return { success: true };
  } catch (error) {
    console.log(error);
    return { success: false, error: "Failed to join organization" };
  }
};

const createOrganization = async (
  name: string,
): Promise<{ id: string; name: string } | null> => {
  try {
    const [org] = await sql<{ id: string; name: string }[]>`
      INSERT INTO organization (id, name)
      VALUES (gen_random_uuid()::TEXT, ${name})
      RETURNING id, name
    `;
    return org ?? null;
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
