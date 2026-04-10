// ---------------------------------------------------------------------------
// Unit tests for src/lib/volcengine-rtc.ts pure TLV helpers.
//
// We only test the *pure* parts (TLV encode/decode, subtitle parsing).
// The RTC engine lifecycle (join/leave/publish) isn't tested here — that
// requires a running Volcengine SDK and is covered indirectly by e2e tests.
// ---------------------------------------------------------------------------

import { describe, it, expect } from "vitest";
import {
  buildAgentCtrlMessage,
  parseSubtitleMessage,
  string2tlv,
} from "@/lib/volcengine-rtc";

// Helper: mimic what the browser does when it decodes the 4-byte ASCII type
function readType(tlv: Uint8Array): string {
  return new TextDecoder("ascii").decode(tlv.slice(0, 4)).replace(/\0+$/, "");
}

function readLength(tlv: Uint8Array): number {
  return (
    (tlv[4] << 24) | (tlv[5] << 16) | (tlv[6] << 8) | tlv[7]
  ) >>> 0;
}

function readPayload(tlv: Uint8Array): string {
  return new TextDecoder("utf-8").decode(tlv.slice(8));
}

describe("string2tlv", () => {
  it("encodes type in first 4 bytes (ASCII)", () => {
    const tlv = string2tlv("{}", "ctrl");
    expect(readType(tlv)).toBe("ctrl");
  });

  it("encodes length as big-endian uint32 matching the UTF-8 payload length", () => {
    const payload = "hello";
    const tlv = string2tlv(payload, "ctrl");
    const len = readLength(tlv);
    expect(len).toBe(5);
    expect(readPayload(tlv)).toBe(payload);
  });

  it("handles multi-byte UTF-8 (Chinese characters) in byte length, not char length", () => {
    // 你好 = 2 chars, but 6 bytes in UTF-8
    const tlv = string2tlv("你好", "subv");
    expect(readLength(tlv)).toBe(6);
    expect(readPayload(tlv)).toBe("你好");
  });

  it("pads short type strings with zero bytes (does not truncate payload)", () => {
    const tlv = string2tlv("x", "ab"); // "ab" is only 2 bytes
    expect(tlv[0]).toBe("a".charCodeAt(0));
    expect(tlv[1]).toBe("b".charCodeAt(0));
    expect(tlv[2]).toBe(0);
    expect(tlv[3]).toBe(0);
    expect(readPayload(tlv)).toBe("x");
  });

  it("truncates type longer than 4 bytes (we only have 4-byte type field)", () => {
    const tlv = string2tlv("x", "abcdef"); // should take "abcd"
    expect(readType(tlv)).toBe("abcd");
  });
});

describe("buildAgentCtrlMessage", () => {
  it("produces a ctrl-typed TLV whose payload is valid JSON with the right shape", () => {
    const msg = buildAgentCtrlMessage(
      "ExternalTextToLLM",
      "[TIME_UP] hello",
      2,
    );
    expect(readType(msg)).toBe("ctrl");

    const parsed = JSON.parse(readPayload(msg));
    expect(parsed).toEqual({
      Command: "ExternalTextToLLM",
      InterruptMode: 2,
      Message: "[TIME_UP] hello",
    });
  });

  it("defaults InterruptMode to 2 (MEDIUM) when not given", () => {
    const msg = buildAgentCtrlMessage("interrupt", "stop");
    const parsed = JSON.parse(readPayload(msg));
    expect(parsed.InterruptMode).toBe(2);
  });

  it("supports all three InterruptMode values", () => {
    for (const mode of [1, 2, 3] as const) {
      const msg = buildAgentCtrlMessage("ExternalTextToLLM", "x", mode);
      const parsed = JSON.parse(readPayload(msg));
      expect(parsed.InterruptMode).toBe(mode);
    }
  });
});

// ---------------------------------------------------------------------------
// parseSubtitleMessage — decode TLV "subv" binary messages coming from the
// RTC binary channel. We build a matching TLV from scratch and round-trip it.
// ---------------------------------------------------------------------------
describe("parseSubtitleMessage", () => {
  const AGENT_ID = "agent-001";
  const USER_ID = "user-001";

  function makeSubv(payloadObj: unknown): ArrayBuffer {
    // Shape follows what the Volcengine RTC demo encodes:
    //   { data: [{ text, definite, userId }] }
    const tlv = string2tlv(JSON.stringify(payloadObj), "subv");
    // Copy into an owned ArrayBuffer because Uint8Array.buffer may be a SharedArrayBuffer
    return tlv.slice().buffer as ArrayBuffer;
  }

  it("returns null for unrelated message types", () => {
    const tlv = string2tlv(JSON.stringify({ data: [{ text: "x", definite: true }] }), "conv");
    const out = parseSubtitleMessage(tlv.slice().buffer as ArrayBuffer, AGENT_ID, AGENT_ID);
    expect(out).toBeNull();
  });

  it("marks agent messages when senderId matches agentUserId", () => {
    const buf = makeSubv({ data: [{ text: "Hello there", definite: true, userId: AGENT_ID }] });
    const out = parseSubtitleMessage(buf, AGENT_ID, AGENT_ID);
    expect(out).not.toBeNull();
    expect(out!.role).toBe("agent");
    expect(out!.text).toBe("Hello there");
    expect(out!.isFinal).toBe(true);
  });

  it("marks non-agent messages as user", () => {
    const buf = makeSubv({ data: [{ text: "I am the candidate", definite: false, userId: USER_ID }] });
    const out = parseSubtitleMessage(buf, USER_ID, AGENT_ID);
    expect(out).not.toBeNull();
    expect(out!.role).toBe("user");
    expect(out!.isFinal).toBe(false);
  });

  it("returns null for empty text", () => {
    const buf = makeSubv({ data: [{ text: "   ", definite: true, userId: USER_ID }] });
    expect(parseSubtitleMessage(buf, USER_ID, AGENT_ID)).toBeNull();
  });

  it("falls back to senderId when userId is missing from payload", () => {
    const buf = makeSubv({ data: [{ text: "anon", definite: true }] });
    // senderId == AGENT_ID → agent role
    expect(parseSubtitleMessage(buf, AGENT_ID, AGENT_ID)!.role).toBe("agent");
    // senderId != AGENT_ID → user role
    expect(parseSubtitleMessage(buf, USER_ID, AGENT_ID)!.role).toBe("user");
  });
});
