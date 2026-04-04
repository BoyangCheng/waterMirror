"use client";

import {
  getAllInterviewers,
  createInterviewer,
  deleteInterviewer,
} from "@/services/interviewers.service";
import { queryKeys } from "@/lib/query-keys";
import type { Interviewer } from "@/types/interviewer";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

/** 获取访谈官列表，staleTime 10min（静态数据，较少变动） */
export function useInterviewersQuery(userId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.interviewers.all(userId ?? ""),
    queryFn: () => getAllInterviewers(userId!),
    enabled: !!userId,
    staleTime: 10 * 60 * 1000,
  });
}

/** 创建访谈官后自动刷新列表 */
export function useCreateInterviewerMutation(userId: string | undefined) {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (payload: any) => createInterviewer(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.interviewers.all(userId ?? "") });
    },
  });
}

/** 删除访谈官 — 乐观更新：立即从缓存移除，失败回滚 */
export function useDeleteInterviewerMutation(userId: string | undefined) {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (id: bigint) => deleteInterviewer(id),
    onMutate: async (id) => {
      const key = queryKeys.interviewers.all(userId ?? "");
      await qc.cancelQueries({ queryKey: key });
      const previous = qc.getQueryData<Interviewer[]>(key);
      qc.setQueryData<Interviewer[]>(key, (old) => old?.filter((i) => i.id !== id) ?? []);
      return { previous };
    },
    onError: (_err, _id, ctx) => {
      qc.setQueryData(queryKeys.interviewers.all(userId ?? ""), ctx?.previous);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: queryKeys.interviewers.all(userId ?? "") });
    },
  });
}
