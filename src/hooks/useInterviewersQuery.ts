"use client";

import {
  getAllInterviewers,
  createInterviewer,
  deleteInterviewer,
} from "@/services/interviewers.service";
import { queryKeys } from "@/lib/query-keys";
import type { Interviewer } from "@/types/interviewer";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

/** 获取当前 org 的面试官列表，staleTime 10min */
export function useInterviewersQuery(orgId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.interviewers.all(orgId ?? ""),
    queryFn: () => getAllInterviewers(orgId!),
    enabled: !!orgId,
    staleTime: 10 * 60 * 1000,
  });
}

/** 创建面试官后自动刷新列表 */
export function useCreateInterviewerMutation(orgId: string | undefined) {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (payload: any) => createInterviewer(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.interviewers.all(orgId ?? "") });
    },
  });
}

/** 删除面试官 — 乐观更新：立即从缓存移除，失败回滚 */
export function useDeleteInterviewerMutation(orgId: string | undefined) {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (id: bigint) => deleteInterviewer(id),
    onMutate: async (id) => {
      const key = queryKeys.interviewers.all(orgId ?? "");
      await qc.cancelQueries({ queryKey: key });
      const previous = qc.getQueryData<Interviewer[]>(key);
      qc.setQueryData<Interviewer[]>(key, (old) => old?.filter((i) => i.id !== id) ?? []);
      return { previous };
    },
    onError: (_err, _id, ctx) => {
      qc.setQueryData(queryKeys.interviewers.all(orgId ?? ""), ctx?.previous);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: queryKeys.interviewers.all(orgId ?? "") });
    },
  });
}
