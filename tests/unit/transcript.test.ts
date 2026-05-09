// ---------------------------------------------------------------------------
// Unit tests for src/lib/transcript.ts
//
// 这些是面试"边接收字幕边聚合 turn 列表"的核心。出 bug 直接影响：
//  - 视频回放时点击 Q/A 跳转的时间戳
//  - 用户要求："如果 ai 的问题被我们合并，则只记录最开始的 offset"
// ---------------------------------------------------------------------------

import { describe, it, expect } from "vitest";
import {
  appendTurn,
  findActiveTurnIndex,
  formatOffset,
  type TranscriptEntry,
} from "@/lib/transcript";

describe("appendTurn — turn 聚合", () => {
  it("第一条字幕：建一个新 entry，offsetMs 为相对 anchor 的差", () => {
    const turns: TranscriptEntry[] = [];
    appendTurn(turns, "agent", "你好", 1500, 1000);
    expect(turns).toEqual([{ role: "agent", content: "你好", offsetMs: 500 }]);
  });

  it("同 role 连续两条：拼到上一个 entry，不新增 entry，offsetMs 保持首条的", () => {
    const turns: TranscriptEntry[] = [];
    appendTurn(turns, "agent", "请先介绍一下", 2000, 1000); // offset=1000
    appendTurn(turns, "agent", "你的过往经历", 5000, 1000); // 同 role，拼接
    expect(turns).toHaveLength(1);
    expect(turns[0]).toEqual({
      role: "agent",
      content: "请先介绍一下 你的过往经历",
      offsetMs: 1000,
    });
  });

  it("role 切换：push 新 entry，offsetMs 为新 anchor 差", () => {
    const turns: TranscriptEntry[] = [];
    appendTurn(turns, "agent", "请先介绍一下", 2000, 1000);
    appendTurn(turns, "user", "好的我叫张三", 6000, 1000);
    expect(turns).toHaveLength(2);
    expect(turns[1]).toEqual({
      role: "user",
      content: "好的我叫张三",
      offsetMs: 5000,
    });
  });

  it("role 切回：再 push 新 entry，不会回填到老的 agent entry", () => {
    const turns: TranscriptEntry[] = [];
    appendTurn(turns, "agent", "Q1", 1000, 0);
    appendTurn(turns, "user", "A1", 5000, 0);
    appendTurn(turns, "agent", "Q2", 9000, 0);
    expect(turns).toHaveLength(3);
    expect(turns[0].content).toBe("Q1");
    expect(turns[1].content).toBe("A1");
    expect(turns[2]).toEqual({ role: "agent", content: "Q2", offsetMs: 9000 });
  });

  it("nowMs < anchorMs 时 offsetMs 钳制为 0（防止时钟漂移产生负值）", () => {
    const turns: TranscriptEntry[] = [];
    appendTurn(turns, "agent", "x", 100, 200);
    expect(turns[0].offsetMs).toBe(0);
  });

  it("空字符串与拼接：上一个为空时不会塞多余空格", () => {
    const turns: TranscriptEntry[] = [
      { role: "agent", content: "", offsetMs: 0 },
    ];
    appendTurn(turns, "agent", "你好", 1000, 1000);
    expect(turns[0].content).toBe("你好");
  });

  it("AI 三句被拆 → 合并成一段，offsetMs 锁定第一句", () => {
    // 用户原话："如果 ai 的问题被我们合并，则只记录最开始的 offset"
    const turns: TranscriptEntry[] = [];
    appendTurn(turns, "agent", "请", 1000, 0);
    appendTurn(turns, "agent", "你介绍一下", 1500, 0);
    appendTurn(turns, "agent", "自己", 2000, 0);
    expect(turns).toHaveLength(1);
    expect(turns[0].offsetMs).toBe(1000);
    expect(turns[0].content).toBe("请 你介绍一下 自己");
  });

  it("函数返回值就是 mutate 后的同一引用（兼容 useRef）", () => {
    const turns: TranscriptEntry[] = [];
    const ret = appendTurn(turns, "agent", "x", 0, 0);
    expect(ret).toBe(turns);
  });
});

describe("findActiveTurnIndex — 视频时间映射 turn 高亮", () => {
  const turns = [
    { offsetMs: 0 },     // turn 0 在 0:00 开始
    { offsetMs: 5_000 }, // turn 1 在 0:05 开始
    { offsetMs: 12_500 },// turn 2 在 0:12.5 开始
  ];

  it("空列表返回 -1", () => {
    expect(findActiveTurnIndex([], 10)).toBe(-1);
  });

  it("当前时间为 0 → 第一个 turn（offset=0）算活跃", () => {
    expect(findActiveTurnIndex(turns, 0)).toBe(0);
  });

  it("当前时间正好等于 turn offset → 选该 turn", () => {
    expect(findActiveTurnIndex(turns, 5)).toBe(1);
  });

  it("当前时间在 turn 区间中段 → 仍然是该 turn", () => {
    expect(findActiveTurnIndex(turns, 8)).toBe(1);
    expect(findActiveTurnIndex(turns, 12.4)).toBe(1);
    expect(findActiveTurnIndex(turns, 12.5)).toBe(2);
  });

  it("当前时间超过最后 turn → 选最后", () => {
    expect(findActiveTurnIndex(turns, 9999)).toBe(2);
  });

  it("当前时间为负 → 没 turn 满足，返回 -1（首 turn offset=0 不算 ≤ 负数）", () => {
    expect(findActiveTurnIndex([{ offsetMs: 0 }], -0.1)).toBe(-1);
  });
});

describe("formatOffset — m:ss 时间格式", () => {
  it("0 → 0:00", () => expect(formatOffset(0)).toBe("0:00"));
  it("半秒四舍五入到 1 秒", () => expect(formatOffset(500)).toBe("0:01"));
  it("整分钟", () => expect(formatOffset(60_000)).toBe("1:00"));
  it("分秒带 0 占位", () => expect(formatOffset(65_000)).toBe("1:05"));
  it("超 10 分钟", () => expect(formatOffset(623_000)).toBe("10:23"));
  it("负数钳制为 0:00", () => expect(formatOffset(-1000)).toBe("0:00"));
});
