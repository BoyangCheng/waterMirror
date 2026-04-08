"use client";

import { getAllInterviews, getInterviewById, deleteInterview } from "@/services/interviews.service";
import { queryKeys } from "@/lib/query-keys";
import type { Interview } from "@/types/interview";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

/** 获取所有面试列表，staleTime 60s，只要 userId & orgId 存在就启用 */
export function useInterviewsQuery(
  userId: string | undefined,
  orgId: string | undefined,
) {
  return useQuery({
    queryKey: queryKeys.interviews.all(userId ?? "", orgId ?? ""),
    queryFn: () => getAllInterviews(userId!, orgId!),
    enabled: !!(userId && orgId),
    staleTime: 60 * 1000,
  });
}

/** 获取单个面试详情，staleTime 5min */
export function useInterviewDetailQuery(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.interviews.detail(id ?? ""),
    queryFn: () => getInterviewById(id!),
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
  });
}

/** 删除面试 — 乐观更新：立即从缓存移除，失败回滚 */
export function useDeleteInterviewMutation(
  userId: string | undefined,
  orgId: string | undefined,
) {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      console.log("[deleteInterviewMutation] mutationFn start → id:", id);
      const result = await deleteInterview(id);
      console.log("[deleteInterviewMutation] mutationFn result:", result);
      return result;
    },
    onMutate: async (id) => {
      console.log("[deleteInterviewMutation] onMutate → userId:", userId, "orgId:", orgId, "id:", id);
      if (!userId || !orgId) {
        console.warn("[deleteInterviewMutation] onMutate SKIP — userId or orgId missing");
        return;
      }
      const key = queryKeys.interviews.all(userId, orgId);
      await qc.cancelQueries({ queryKey: key });
      const previous = qc.getQueryData<Interview[]>(key);
      qc.setQueryData<Interview[]>(key, (old) => old?.filter((i) => i.id !== id) ?? []);
      return { previous };
    },
    onSuccess: (data, id) => {
      console.log("[deleteInterviewMutation] onSuccess → id:", id, "data:", data);
    },
    onError: (err, id, ctx) => {
      console.error("[deleteInterviewMutation] onError → id:", id, "error:", err);
      if (!userId || !orgId || !ctx?.previous) return;
      qc.setQueryData(queryKeys.interviews.all(userId, orgId), ctx.previous);
    },
    onSettled: (data, error, id) => {
      console.log("[deleteInterviewMutation] onSettled → userId:", userId, "orgId:", orgId, "id:", id, "error:", error);
      if (!userId || !orgId) {
        console.warn("[deleteInterviewMutation] onSettled SKIP — userId or orgId missing, UI will NOT refresh");
        return;
      }
      qc.invalidateQueries({ queryKey: queryKeys.interviews.all(userId, orgId) });
    },
  });
}
