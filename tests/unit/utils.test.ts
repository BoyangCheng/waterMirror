// ---------------------------------------------------------------------------
// Unit tests for src/lib/utils.ts
// Small utility functions — easy to test, easy to break, worth covering.
// ---------------------------------------------------------------------------

import { describe, it, expect } from "vitest";
import {
  cn,
  convertSecondstoMMSS,
  convertToAscii,
  formatTimestampToDateHHMM,
  isLightColor,
  testEmail,
} from "@/lib/utils";

describe("cn", () => {
  it("merges class name strings", () => {
    expect(cn("a", "b")).toContain("a");
    expect(cn("a", "b")).toContain("b");
  });

  it("drops falsy values", () => {
    // biome-ignore lint: intentional mix of falsy for test
    const out = cn("keep", false && "drop", null, undefined, 0 && "zero", "also-keep");
    expect(out).toBe("keep also-keep");
  });

  it("deduplicates conflicting tailwind classes (last wins)", () => {
    // p-2 and p-4 conflict; twMerge should keep p-4
    expect(cn("p-2", "p-4")).toBe("p-4");
  });
});

describe("testEmail", () => {
  it("accepts common email shapes", () => {
    expect(testEmail("a@b.co")).toBe(true);
    expect(testEmail("first.last@example.com")).toBe(true);
    expect(testEmail("x+y@z.io")).toBe(true);
  });

  it("rejects obvious non-emails", () => {
    expect(testEmail("")).toBe(false);
    expect(testEmail("no-at-sign")).toBe(false);
    expect(testEmail("missing@tld")).toBe(false);
    expect(testEmail("@nouser.com")).toBe(false);
  });
});

describe("convertToAscii", () => {
  it("strips non-ASCII characters", () => {
    expect(convertToAscii("hello")).toBe("hello");
    expect(convertToAscii("héllo")).toBe("hllo");
    expect(convertToAscii("你好 world")).toBe(" world");
  });
});

describe("convertSecondstoMMSS", () => {
  it("formats zero correctly", () => {
    expect(convertSecondstoMMSS(0)).toBe("0m 00s");
  });

  it("formats sub-minute durations", () => {
    expect(convertSecondstoMMSS(5)).toBe("0m 05s");
    expect(convertSecondstoMMSS(59)).toBe("0m 59s");
  });

  it("formats multi-minute durations", () => {
    expect(convertSecondstoMMSS(60)).toBe("1m 00s");
    expect(convertSecondstoMMSS(125)).toBe("2m 05s");
    expect(convertSecondstoMMSS(3_600)).toBe("60m 00s");
  });
});

describe("isLightColor", () => {
  it("detects white as light", () => {
    expect(isLightColor("#ffffff")).toBe(true);
  });

  it("detects black as not light", () => {
    expect(isLightColor("#000000")).toBe(false);
  });

  it("works without the leading #", () => {
    expect(isLightColor("ffffff")).toBe(true);
  });

  it("handles a saturated mid-brightness color (uses the 155 cutoff)", () => {
    // rgb(200,200,200) → brightness 200 → light
    expect(isLightColor("#c8c8c8")).toBe(true);
    // rgb(100,100,100) → brightness 100 → dark
    expect(isLightColor("#646464")).toBe(false);
  });
});

describe("formatTimestampToDateHHMM", () => {
  it("produces a DD-MM-YYYY HH:MM string", () => {
    // Build a date in local time so the test is tz-independent
    const d = new Date(2024, 2, 7, 9, 5); // 2024-03-07 09:05 local
    const out = formatTimestampToDateHHMM(d.toISOString());
    expect(out).toMatch(/^\d{2}-\d{2}-\d{4} \d{2}:\d{2}$/);
    expect(out.startsWith("07-03-2024")).toBe(true);
    expect(out.endsWith("09:05")).toBe(true);
  });
});
