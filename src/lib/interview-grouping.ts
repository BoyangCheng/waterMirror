// ---------------------------------------------------------------------------
// Dashboard 把面试按 job 分组的纯函数
//
// 规则：
//   - 每个有面试的 job 一组，按 jobs 入参顺序输出
//   - job_id 为 null / 找不到对应 job 的面试 → "其他"组
//   - "其他"组只在有面试时出现
//   - 所有空组都过滤掉
// ---------------------------------------------------------------------------

export interface JobLite {
  id: string;
  name: string;
}

export interface InterviewLite {
  id: string;
  job_id?: string | null;
}

export interface InterviewGroup<T extends InterviewLite> {
  jobId: string | null;
  jobName: string;
  items: T[];
}

export function groupInterviewsByJob<T extends InterviewLite>(
  interviews: ReadonlyArray<T>,
  jobs: ReadonlyArray<JobLite>,
  otherLabel: string,
): InterviewGroup<T>[] {
  // 用 Map 一次过把面试丢进对应桶
  const lookup = new Map<string, { jobName: string; items: T[] }>();
  for (const j of jobs) {
    lookup.set(j.id, { jobName: j.name, items: [] });
  }
  const otherItems: T[] = [];

  for (const iv of interviews) {
    const jid = iv.job_id ?? null;
    if (jid && lookup.has(jid)) {
      lookup.get(jid)!.items.push(iv);
    } else {
      // job_id 为 null，或对应 job 已被删除 / 不在当前 jobs 列表里
      otherItems.push(iv);
    }
  }

  // 按 jobs 顺序输出非空组
  const out: InterviewGroup<T>[] = [];
  for (const j of jobs) {
    const bucket = lookup.get(j.id);
    if (bucket && bucket.items.length > 0) {
      out.push({ jobId: j.id, jobName: bucket.jobName, items: bucket.items });
    }
  }
  if (otherItems.length > 0) {
    out.push({ jobId: null, jobName: otherLabel, items: otherItems });
  }
  return out;
}
