"use client";

import { getOrganizationById } from "@/services/clients.service";
import { getResponseCountByOrganizationId } from "@/services/responses.service";
import { queryKeys } from "@/lib/query-keys";
import { useQuery } from "@tanstack/react-query";

/** 获取组织信息，staleTime 5min */
export function useOrganizationQuery(orgId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.organization.detail(orgId ?? ""),
    queryFn: () => getOrganizationById(orgId!),
    enabled: !!orgId,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * 获取组织的回复总数，用于判断免费版限额。
 * 仅在 enabled=true 时触发（调用方控制：只有 plan==='free' 时才查）
 */
export function useResponseCountQuery(
  orgId: string | undefined,
  enabled = true,
) {
  return useQuery({
    queryKey: queryKeys.organization.responseCount(orgId ?? ""),
    queryFn: () => getResponseCountByOrganizationId(orgId!),
    enabled: !!orgId && enabled,
    staleTime: 30 * 1000,
  });
}
