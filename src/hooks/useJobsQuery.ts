"use client";

import { getAllJobs, deleteJob } from "@/services/jobs.service";
import { queryKeys } from "@/lib/query-keys";
import type { Job } from "@/types/job";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

/**
 * 获取岗位列表。
 * - staleTime 30s
 * - 当有任意岗位处于 "processing" 状态时，自动每 5s 轮询一次
 */
export function useJobsQuery(
  userId: string | undefined,
  orgId: string | undefined,
) {
  return useQuery({
    queryKey: queryKeys.jobs.all(userId ?? "", orgId ?? ""),
    queryFn: () => getAllJobs(userId!, orgId!),
    enabled: !!(userId && orgId),
    staleTime: 30 * 1000,
    refetchInterval: (query) => {
      const data = query.state.data as Job[] | undefined;
      return data?.some((j) => j.status === "processing") ? 5000 : false;
    },
  });
}

/** 删除岗位 — 乐观更新：立即从缓存移除，失败回滚 */
export function useDeleteJobMutation(
  userId: string | undefined,
  orgId: string | undefined,
) {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deleteJob(id),
    onMutate: async (id) => {
      if (!userId || !orgId) return;
      const key = queryKeys.jobs.all(userId, orgId);
      await qc.cancelQueries({ queryKey: key });
      const previous = qc.getQueryData<Job[]>(key);
      qc.setQueryData<Job[]>(key, (old) => old?.filter((j) => j.id !== id) ?? []);
      return { previous };
    },
    onError: (_err, _id, ctx) => {
      if (!userId || !orgId || !ctx?.previous) return;
      qc.setQueryData(queryKeys.jobs.all(userId, orgId), ctx.previous);
    },
    onSettled: () => {
      if (!userId || !orgId) return;
      qc.invalidateQueries({ queryKey: queryKeys.jobs.all(userId, orgId) });
    },
  });
}
