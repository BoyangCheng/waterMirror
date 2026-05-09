// ---------------------------------------------------------------------------
// Unit tests for src/lib/oss.ts pure helpers
//
// 只测纯函数：getCallVideoObjectKey + getResumeObjectKey 的 key 拼装。
// 涉及真实 OSS client / 网络的函数（uploadToOSS / appendToOSS / getPresignedPutUrl）
// 在 unit test 里用 mock 成本远大于价值，留给 e2e。
// ---------------------------------------------------------------------------

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getCallVideoObjectKey, getResumeObjectKey } from "@/lib/oss";

describe("getCallVideoObjectKey", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-09T10:00:00Z"));
  });
  afterEach(() => vi.useRealTimers());

  it("路径前缀固定为 call-videos/{callId}/", () => {
    const key = getCallVideoObjectKey("abc123");
    expect(key.startsWith("call-videos/abc123/")).toBe(true);
  });

  it("以 .webm 结尾（前端固定录制 webm）", () => {
    expect(getCallVideoObjectKey("abc123")).toMatch(/\.webm$/);
  });

  it("包含调用时刻的毫秒时间戳，相同 callId 不同时刻不撞 key", () => {
    const k1 = getCallVideoObjectKey("abc123");
    vi.setSystemTime(new Date("2026-05-09T10:00:00.001Z"));
    const k2 = getCallVideoObjectKey("abc123");
    expect(k1).not.toBe(k2);
  });

  it("时间戳是数字字符串（防止误用 toISOString 之类带冒号的格式 — 会被某些 OSS 拦）", () => {
    const key = getCallVideoObjectKey("abc123");
    const fname = key.split("/").pop()!;
    expect(fname).toMatch(/^\d+\.webm$/);
  });
});

describe("getResumeObjectKey", () => {
  it("正常 ASCII 文件名保留", () => {
    const key = getResumeObjectKey("job1", "resume.pdf");
    expect(key).toContain("resumes/job1/");
    expect(key.endsWith("_resume.pdf")).toBe(true);
  });

  it("中文文件名保留（在白名单里）", () => {
    const key = getResumeObjectKey("job1", "张三的简历.pdf");
    expect(key).toMatch(/张三的简历\.pdf$/);
  });

  it("特殊字符（空格、括号、问号）会被替换成下划线，避免 OSS URL 解析问题", () => {
    const key = getResumeObjectKey("job1", "my resume (final)?.pdf");
    expect(key).not.toMatch(/[\s()?]/);
  });

  it("路径前缀按 jobId 隔离，不同 job 不撞 key", () => {
    const k1 = getResumeObjectKey("jobA", "x.pdf");
    const k2 = getResumeObjectKey("jobB", "x.pdf");
    expect(k1).not.toBe(k2);
    expect(k1.startsWith("resumes/jobA/")).toBe(true);
    expect(k2.startsWith("resumes/jobB/")).toBe(true);
  });
});
