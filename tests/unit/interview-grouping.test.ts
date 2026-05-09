// ---------------------------------------------------------------------------
// Unit tests for src/lib/interview-grouping.ts
//
// Dashboard 用这个把面试按岗位分组成行渲染。
// 用户原话："不是岗位生成的面试归类到其他"、"创建面试独立一行在最上方"
// 这里只测纯函数；CreateInterviewCard 的位置由 dashboard/page.tsx 渲染顺序决定，不在这里测。
// ---------------------------------------------------------------------------

import { describe, it, expect } from "vitest";
import {
  groupInterviewsByJob,
  type JobLite,
  type InterviewLite,
} from "@/lib/interview-grouping";

const jobs: JobLite[] = [
  { id: "j1", name: "办公室主任" },
  { id: "j2", name: "数据分析师" },
];

describe("groupInterviewsByJob", () => {
  it("空 interviews → 空数组", () => {
    expect(groupInterviewsByJob([], jobs, "其他")).toEqual([]);
  });

  it("空 jobs + 有面试 → 全部归到'其他'", () => {
    const interviews: InterviewLite[] = [
      { id: "i1" },
      { id: "i2", job_id: "j999" },
    ];
    const r = groupInterviewsByJob(interviews, [], "其他");
    expect(r).toEqual([
      { jobId: null, jobName: "其他", items: interviews },
    ]);
  });

  it("没有面试归到 j1 → j1 桶不出现（只输出非空组）", () => {
    const interviews: InterviewLite[] = [{ id: "i1", job_id: "j2" }];
    const r = groupInterviewsByJob(interviews, jobs, "其他");
    expect(r).toHaveLength(1);
    expect(r[0].jobId).toBe("j2");
    expect(r[0].jobName).toBe("数据分析师");
  });

  it("有 job 关联 + 有手动创建 → 'job 组'按 jobs 顺序，'其他'垫底", () => {
    const interviews: InterviewLite[] = [
      { id: "i1", job_id: "j2" },         // 数据分析师
      { id: "i2", job_id: "j1" },         // 办公室主任
      { id: "i3", job_id: null },         // 其他（手动创建）
      { id: "i4" },                        // 其他（job_id 字段缺失）
      { id: "i5", job_id: "j_deleted" }, // 其他（job 已删，找不到）
    ];
    const r = groupInterviewsByJob(interviews, jobs, "其他");
    expect(r).toHaveLength(3);
    // jobs 顺序：j1 在前 → 第 0 组应是 j1
    expect(r[0]).toEqual({
      jobId: "j1",
      jobName: "办公室主任",
      items: [{ id: "i2", job_id: "j1" }],
    });
    expect(r[1]).toEqual({
      jobId: "j2",
      jobName: "数据分析师",
      items: [{ id: "i1", job_id: "j2" }],
    });
    expect(r[2]).toEqual({
      jobId: null,
      jobName: "其他",
      items: [
        { id: "i3", job_id: null },
        { id: "i4" },
        { id: "i5", job_id: "j_deleted" },
      ],
    });
  });

  it("'其他'桶为空 → 不输出 '其他' 组", () => {
    const interviews: InterviewLite[] = [
      { id: "i1", job_id: "j1" },
      { id: "i2", job_id: "j2" },
    ];
    const r = groupInterviewsByJob(interviews, jobs, "其他");
    expect(r.map((g) => g.jobId)).toEqual(["j1", "j2"]);
    expect(r.find((g) => g.jobId === null)).toBeUndefined();
  });

  it("同 job 多个面试 → 全部进同一桶，顺序保持原 interviews 顺序", () => {
    const interviews: InterviewLite[] = [
      { id: "a", job_id: "j1" },
      { id: "b", job_id: "j1" },
      { id: "c", job_id: "j1" },
    ];
    const r = groupInterviewsByJob(interviews, jobs, "其他");
    expect(r[0].items.map((i) => i.id)).toEqual(["a", "b", "c"]);
  });

  it("otherLabel 参数被使用（i18n 友好）", () => {
    const r = groupInterviewsByJob(
      [{ id: "i1" }],
      jobs,
      "Other",
    );
    expect(r[0].jobName).toBe("Other");
  });

  it("泛型保留：返回 items 元素类型与入参一致", () => {
    interface Custom extends InterviewLite {
      customField: string;
    }
    const interviews: Custom[] = [{ id: "x", job_id: "j1", customField: "hi" }];
    const r = groupInterviewsByJob<Custom>(interviews, jobs, "其他");
    // 编译期就保证 r[0].items[0].customField 可访问
    expect(r[0].items[0].customField).toBe("hi");
  });
});
