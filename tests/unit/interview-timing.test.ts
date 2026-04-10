// ---------------------------------------------------------------------------
// Unit tests for src/lib/interview-timing.ts
//
// 这些是面试"快结束"提示 + 自动挂断逻辑的核心。出了 bug 会导致：
//  - AI 没来得及说结束语，用户体验差
//  - 面试无限跑下去，RTC 成本爆炸
//
// 所以对阈值 / 边界 / 异常输入都要有覆盖。
// ---------------------------------------------------------------------------

import { describe, it, expect } from "vitest";
import {
  TIME_UP_GRACE_MS,
  TIME_UP_PROMPT,
  TIME_UP_WARNING_LEAD_SECS,
  computeEndDelayMs,
  parseInterviewDurationMinutes,
  shouldForceEnd,
  shouldSendTimeUpWarning,
} from "@/lib/interview-timing";

describe("interview-timing constants", () => {
  it("lead secs is 10 (played 10s before interview end)", () => {
    expect(TIME_UP_WARNING_LEAD_SECS).toBe(10);
  });

  it("grace period is 15s", () => {
    expect(TIME_UP_GRACE_MS).toBe(15000);
  });

  it("TIME_UP_PROMPT starts with the [TIME_UP] marker the system prompt looks for", () => {
    expect(TIME_UP_PROMPT.startsWith("[TIME_UP]")).toBe(true);
  });
});

describe("shouldSendTimeUpWarning", () => {
  const base = {
    isCalling: true,
    alreadySent: false,
    elapsedSeconds: 0,
    totalSeconds: 600, // 10 min interview
  };

  it("returns false when not calling", () => {
    expect(
      shouldSendTimeUpWarning({ ...base, isCalling: false, elapsedSeconds: 595 }),
    ).toBe(false);
  });

  it("returns false when warning already sent", () => {
    expect(
      shouldSendTimeUpWarning({ ...base, alreadySent: true, elapsedSeconds: 595 }),
    ).toBe(false);
  });

  it("returns false well before the 10s threshold", () => {
    // at t=100s of a 600s interview, the threshold is t=590
    expect(shouldSendTimeUpWarning({ ...base, elapsedSeconds: 100 })).toBe(false);
  });

  it("returns false exactly 11s before end (still outside window)", () => {
    // 600 - 10 = 590; at 589 we should NOT fire yet
    expect(shouldSendTimeUpWarning({ ...base, elapsedSeconds: 589 })).toBe(false);
  });

  it("fires the tick it reaches the window (exactly T - lead)", () => {
    expect(shouldSendTimeUpWarning({ ...base, elapsedSeconds: 590 })).toBe(true);
  });

  it("still fires if we somehow overshot the threshold", () => {
    // Timer jitter / tab throttling can skip ticks
    expect(shouldSendTimeUpWarning({ ...base, elapsedSeconds: 598 })).toBe(true);
  });

  it("returns false when total duration <= lead (too short, use fallback)", () => {
    expect(
      shouldSendTimeUpWarning({ ...base, totalSeconds: 10, elapsedSeconds: 5 }),
    ).toBe(false);
    expect(
      shouldSendTimeUpWarning({ ...base, totalSeconds: 5, elapsedSeconds: 5 }),
    ).toBe(false);
  });

  it("returns false for NaN / non-finite inputs", () => {
    expect(
      shouldSendTimeUpWarning({ ...base, totalSeconds: Number.NaN, elapsedSeconds: 10 }),
    ).toBe(false);
    expect(
      shouldSendTimeUpWarning({ ...base, totalSeconds: 600, elapsedSeconds: Number.NaN }),
    ).toBe(false);
  });

  it("accepts a custom leadSecs override", () => {
    // With a 30s lead, at 570s of a 600s interview we should fire
    expect(
      shouldSendTimeUpWarning({ ...base, elapsedSeconds: 570, leadSecs: 30 }),
    ).toBe(true);
    // But at 569 we should not
    expect(
      shouldSendTimeUpWarning({ ...base, elapsedSeconds: 569, leadSecs: 30 }),
    ).toBe(false);
  });
});

describe("computeEndDelayMs", () => {
  it("defaults to lead*1000 + grace (= 10_000 + 15_000 = 25_000 ms)", () => {
    expect(computeEndDelayMs()).toBe(25_000);
  });

  it("respects custom overrides", () => {
    expect(computeEndDelayMs(5, 2_000)).toBe(7_000);
    expect(computeEndDelayMs(0, 0)).toBe(0);
  });
});

describe("shouldForceEnd", () => {
  const base = {
    isCalling: true,
    endScheduled: false,
    elapsedSeconds: 600,
    totalSeconds: 600,
  };

  it("fires when time is up and no end is scheduled", () => {
    expect(shouldForceEnd(base)).toBe(true);
  });

  it("does not fire if an end is already scheduled (warning path won)", () => {
    expect(shouldForceEnd({ ...base, endScheduled: true })).toBe(false);
  });

  it("does not fire if not calling", () => {
    expect(shouldForceEnd({ ...base, isCalling: false })).toBe(false);
  });

  it("does not fire before the total", () => {
    expect(shouldForceEnd({ ...base, elapsedSeconds: 599 })).toBe(false);
  });

  it("does not fire for invalid total", () => {
    expect(shouldForceEnd({ ...base, totalSeconds: 0 })).toBe(false);
    expect(shouldForceEnd({ ...base, totalSeconds: Number.NaN })).toBe(false);
  });
});

describe("parseInterviewDurationMinutes", () => {
  it("parses integer minute strings", () => {
    expect(parseInterviewDurationMinutes("10")).toBe(600);
    expect(parseInterviewDurationMinutes("1")).toBe(60);
  });

  it("parses numbers", () => {
    expect(parseInterviewDurationMinutes(15)).toBe(900);
  });

  it("rounds fractional minutes to the nearest second", () => {
    expect(parseInterviewDurationMinutes("0.5")).toBe(30);
    expect(parseInterviewDurationMinutes("1.25")).toBe(75);
  });

  it("returns 0 for garbage", () => {
    expect(parseInterviewDurationMinutes("")).toBe(0);
    expect(parseInterviewDurationMinutes("not a number")).toBe(0);
    expect(parseInterviewDurationMinutes(null)).toBe(0);
    expect(parseInterviewDurationMinutes(undefined)).toBe(0);
    expect(parseInterviewDurationMinutes(-5)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Integration-style test: simulate a 1-second-tick timer and make sure the
// warning fires exactly once at T-10 and shouldForceEnd stays quiet once an
// end is scheduled.
// ---------------------------------------------------------------------------
describe("timer simulation (end-to-end of the timing state machine)", () => {
  it("fires warning once at T-10, then force-end stays suppressed", () => {
    const totalSeconds = 60; // 1-min interview
    let warningsFired = 0;
    let forceEnds = 0;
    let alreadySent = false;
    let endScheduled = false;

    for (let t = 0; t <= totalSeconds + 5; t++) {
      if (
        shouldSendTimeUpWarning({
          isCalling: true,
          alreadySent,
          elapsedSeconds: t,
          totalSeconds,
        })
      ) {
        warningsFired++;
        alreadySent = true;
        endScheduled = true; // component would schedule setTimeout here
      }

      if (
        shouldForceEnd({
          isCalling: true,
          endScheduled,
          elapsedSeconds: t,
          totalSeconds,
        })
      ) {
        forceEnds++;
      }
    }

    expect(warningsFired).toBe(1);
    // force-end must not double-fire while warning path owns the teardown
    expect(forceEnds).toBe(0);
  });

  it("short interview (<= lead) skips warning, force-end kicks in", () => {
    const totalSeconds = 5; // 5-sec interview, shorter than 10s lead
    let warningsFired = 0;
    let forceEnds = 0;
    let alreadySent = false;
    const endScheduled = false;

    for (let t = 0; t <= totalSeconds + 2; t++) {
      if (
        shouldSendTimeUpWarning({
          isCalling: true,
          alreadySent,
          elapsedSeconds: t,
          totalSeconds,
        })
      ) {
        warningsFired++;
        alreadySent = true;
      }
      if (
        shouldForceEnd({
          isCalling: true,
          endScheduled,
          elapsedSeconds: t,
          totalSeconds,
        })
      ) {
        forceEnds++;
        break; // component would call handleEndCall, test stops
      }
    }

    expect(warningsFired).toBe(0);
    expect(forceEnds).toBe(1);
  });
});
