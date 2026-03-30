"use server";

import sql from "@/lib/db";

const updateOrganization = async (payload: any, id: string) => {
  try {
    await sql`UPDATE organization SET ${sql(payload)} WHERE id = ${id}`;
    return null;
  } catch (error) {
    console.log(error);
    return [];
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
    return [];
  }
};

export const ClientService = {
  updateOrganization,
  getClientById,
  getOrganizationById,
};
