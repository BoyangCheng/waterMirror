"use client";

import { useAuth, useOrg } from "@/contexts/auth.context";
import { getClientById, getOrganizationById } from "@/services/clients.service";
import { queryKeys } from "@/lib/query-keys";
import type { User } from "@/types/user";
import { useQuery } from "@tanstack/react-query";
import React, { useContext, type ReactNode } from "react";

interface ClientContextProps {
  client?: User;
}

export const ClientContext = React.createContext<ClientContextProps>({
  client: undefined,
});

export function ClientProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { organization } = useOrg();

  // Upsert 用户到数据库（每个会话仅执行一次，staleTime=Infinity 保证不重复请求）
  const { data: client } = useQuery({
    queryKey: queryKeys.organization.ensureClient(user?.id ?? ""),
    queryFn: () =>
      getClientById(
        user!.id,
        user!.emailAddresses[0]?.emailAddress,
        organization?.id,
      ),
    enabled: !!user?.id,
    staleTime: Infinity,
    gcTime: Infinity,
  });

  // Upsert 组织到数据库（每个会话仅执行一次）
  useQuery({
    queryKey: queryKeys.organization.ensureOrg(organization?.id ?? ""),
    queryFn: () => getOrganizationById(organization!.id, organization!.name),
    enabled: !!organization?.id,
    staleTime: Infinity,
    gcTime: Infinity,
  });

  return (
    <ClientContext.Provider value={{ client }}>
      {children}
    </ClientContext.Provider>
  );
}

export const useClient = () => useContext(ClientContext);
