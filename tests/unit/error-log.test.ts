// ---------------------------------------------------------------------------
// Unit tests for src/lib/error-log.ts
//
// 覆盖：
//  - truncate / safeStringify 边界
//  - normalizeErrorLogEntry 各种 input 形态 (Error / string / unknown / 循环引用)
//  - shouldDedupe 时间窗口
//  - recordError 的 fire-and-forget 语义 (sink throw 不上抛)
//  - withErrorLogging:
//      - 包装成功 response → sink 不被调用
//      - 包装 500 response → sink 被调用，请求仍正常返回
//      - handler throw → sink 被调用，返回 500 JSON
// ---------------------------------------------------------------------------

import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  __resetDedupForTesting,
  __setSinkForTesting,
  MAX_CONTEXT_JSON_LEN,
  MAX_MESSAGE_LEN,
  MAX_STACK_LEN,
  type NormalizedErrorLogEntry,
  normalizeErrorLogEntry,
  recordError,
  safeStringify,
  shouldDedupe,
  truncate,
  withErrorLogging,
} from "@/lib/error-log";

beforeEach(() => {
  __resetDedupForTesting();
});

describe("truncate", () => {
  it("returns the string unchanged if within limit", () => {
    expect(truncate("hello", 10)).toBe("hello");
    expect(truncate("hello", 5)).toBe("hello");
  });

  it("truncates and appends marker if exceeding", () => {
    const out = truncate("abcdefghij", 3);
    expect(out.startsWith("abc")).toBe(true);
    expect(out).toContain("…(truncated)");
  });
});

describe("safeStringify", () => {
  it("handles null / undefined", () => {
    expect(safeStringify(null)).toBe("null");
    expect(safeStringify(undefined)).toBe("undefined");
  });

  it("returns strings as-is", () => {
    expect(safeStringify("hi")).toBe("hi");
  });

  it("serializes plain objects as JSON", () => {
    expect(safeStringify({ a: 1, b: "x" })).toBe('{"a":1,"b":"x"}');
  });

  it("formats Error with name + message + stack", () => {
    const err = new Error("boom");
    err.stack = "Error: boom\n  at foo";
    const out = safeStringify(err);
    expect(out).toContain("Error: boom");
    expect(out).toContain("at foo");
  });

  it("handles bigint", () => {
    expect(safeStringify({ big: 10n })).toContain('"big":"10"');
  });

  it("handles circular refs without throwing", () => {
    const a: Record<string, unknown> = { name: "a" };
    a.self = a;
    const out = safeStringify(a);
    expect(out).toContain("[Circular]");
  });

  it("replaces functions with a placeholder", () => {
    expect(safeStringify({ fn: () => 1 })).toContain("[Function]");
  });
});

describe("normalizeErrorLogEntry", () => {
  it("defaults level to 'error' and pulls env from process", () => {
    const out = normalizeErrorLogEntry({ source: "api", message: "boom" });
    expect(out.level).toBe("error");
    expect(out.environment).toBeTypeOf("string");
    expect(out.source).toBe("api");
  });

  it("pulls message + stack from a raw Error", () => {
    const err = new Error("something failed");
    err.stack = "Error: something failed\n    at line";
    const out = normalizeErrorLogEntry({ source: "api", error: err });
    expect(out.message).toBe("something failed");
    expect(out.stack).toContain("at line");
  });

  it("prefers explicit message over error.message", () => {
    const err = new Error("internal detail");
    const out = normalizeErrorLogEntry({
      source: "api",
      message: "user-facing label",
      error: err,
    });
    expect(out.message).toBe("user-facing label");
    // but stack still comes from error
    expect(out.stack).toBeTruthy();
  });

  it("falls back to 'Unknown error' when nothing is given", () => {
    const out = normalizeErrorLogEntry({ source: "service" });
    expect(out.message).toBe("Unknown error");
    expect(out.stack).toBeNull();
  });

  it("stringifies unknown error values", () => {
    const out = normalizeErrorLogEntry({ source: "api", error: { code: 42 } });
    expect(out.message).toContain('"code":42');
  });

  it("accepts a plain string as error", () => {
    const out = normalizeErrorLogEntry({ source: "api", error: "plain string" });
    expect(out.message).toBe("plain string");
  });

  it("truncates overly long messages", () => {
    const big = "x".repeat(MAX_MESSAGE_LEN + 500);
    const out = normalizeErrorLogEntry({ source: "api", message: big });
    expect(out.message.length).toBeLessThanOrEqual(MAX_MESSAGE_LEN + 20); // + "…(truncated)"
    expect(out.message.endsWith("…(truncated)")).toBe(true);
  });

  it("truncates overly long stacks", () => {
    const err = new Error("x");
    err.stack = "y".repeat(MAX_STACK_LEN + 500);
    const out = normalizeErrorLogEntry({ source: "api", error: err });
    expect(out.stack!.endsWith("…(truncated)")).toBe(true);
  });

  it("preserves small context objects as-is", () => {
    const ctx = { userId: "u1", step: 2 };
    const out = normalizeErrorLogEntry({ source: "api", message: "x", context: ctx });
    expect(out.context).toEqual(ctx);
  });

  it("replaces oversized context with a _truncated marker", () => {
    const ctx = { huge: "z".repeat(MAX_CONTEXT_JSON_LEN + 100) };
    const out = normalizeErrorLogEntry({ source: "api", message: "x", context: ctx });
    expect(out.context).not.toBeNull();
    expect((out.context as Record<string, unknown>)._truncated).toBe(true);
    expect((out.context as Record<string, unknown>)._originalLength).toBeGreaterThan(
      MAX_CONTEXT_JSON_LEN,
    );
  });

  it("passes identifying fields through untouched", () => {
    const out = normalizeErrorLogEntry({
      source: "api",
      message: "x",
      route: "/api/foo",
      statusCode: 500,
      userId: "u1",
      orgId: "o1",
      requestId: "req-1",
      userAgent: "Mozilla/5.0",
    });
    expect(out.route).toBe("/api/foo");
    expect(out.status_code).toBe(500);
    expect(out.user_id).toBe("u1");
    expect(out.org_id).toBe("o1");
    expect(out.request_id).toBe("req-1");
    expect(out.user_agent).toBe("Mozilla/5.0");
  });
});

describe("shouldDedupe", () => {
  const entry = (message: string, route = "/api/x"): NormalizedErrorLogEntry => ({
    level: "error",
    source: "api",
    route,
    message,
    stack: null,
    status_code: null,
    user_id: null,
    org_id: null,
    request_id: null,
    environment: "test",
    user_agent: null,
    context: null,
  });

  it("first occurrence is not deduped", () => {
    expect(shouldDedupe(entry("x"), 1000)).toBe(false);
  });

  it("same message inside 1s is deduped", () => {
    shouldDedupe(entry("x"), 1000);
    expect(shouldDedupe(entry("x"), 1500)).toBe(true);
  });

  it("same message after 1s is allowed again", () => {
    shouldDedupe(entry("x"), 1000);
    expect(shouldDedupe(entry("x"), 2100)).toBe(false);
  });

  it("different messages are not deduped", () => {
    shouldDedupe(entry("a"), 1000);
    expect(shouldDedupe(entry("b"), 1000)).toBe(false);
  });

  it("different routes are not deduped", () => {
    shouldDedupe(entry("x", "/api/a"), 1000);
    expect(shouldDedupe(entry("x", "/api/b"), 1000)).toBe(false);
  });
});

describe("recordError (fire-and-forget)", () => {
  it("calls the sink with a normalized entry", async () => {
    const sink = vi.fn(async () => undefined);
    const restore = __setSinkForTesting(sink);
    try {
      await recordError({ source: "api", message: "hello", route: "/foo" });
      expect(sink).toHaveBeenCalledTimes(1);
      const arg = sink.mock.calls[0]![0]!;
      expect(arg.message).toBe("hello");
      expect(arg.route).toBe("/foo");
      expect(arg.level).toBe("error");
    } finally {
      restore();
    }
  });

  it("never throws even if sink throws", async () => {
    const sink = vi.fn(async () => {
      throw new Error("db down");
    });
    const restore = __setSinkForTesting(sink);
    try {
      // vi console.error spy so test output stays clean
      const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
      await expect(
        recordError({ source: "api", message: "boom" }),
      ).resolves.toBeUndefined();
      expect(sink).toHaveBeenCalled();
      spy.mockRestore();
    } finally {
      restore();
    }
  });

  it("dedupes rapid repeats", async () => {
    const sink = vi.fn(async () => undefined);
    const restore = __setSinkForTesting(sink);
    try {
      await recordError({ source: "api", message: "same", route: "/x" });
      await recordError({ source: "api", message: "same", route: "/x" });
      await recordError({ source: "api", message: "same", route: "/x" });
      expect(sink).toHaveBeenCalledTimes(1);
    } finally {
      restore();
    }
  });
});

describe("withErrorLogging", () => {
  it("passes a 200 response through and does not touch the sink", async () => {
    const sink = vi.fn(async () => undefined);
    const restore = __setSinkForTesting(sink);
    try {
      const handler = withErrorLogging("/api/ok", async () => {
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      });
      const resp = await handler(new Request("http://test/api/ok"));
      expect(resp.status).toBe(200);
      expect(sink).not.toHaveBeenCalled();
    } finally {
      restore();
    }
  });

  it("records a failure response (>= 500) without consuming the body", async () => {
    const sink = vi.fn(async () => undefined);
    const restore = __setSinkForTesting(sink);
    try {
      const handler = withErrorLogging("/api/fail", async () => {
        return new Response(JSON.stringify({ error: "oops" }), { status: 500 });
      });
      const resp = await handler(new Request("http://test/api/fail"));
      expect(resp.status).toBe(500);
      // Caller still gets an intact body
      const body = await resp.json();
      expect(body.error).toBe("oops");
      expect(sink).toHaveBeenCalledTimes(1);
      const logged = sink.mock.calls[0]![0]!;
      expect(logged.status_code).toBe(500);
      expect(logged.route).toBe("/api/fail");
    } finally {
      restore();
    }
  });

  it("catches thrown errors and returns a generic 500", async () => {
    const sink = vi.fn(async () => undefined);
    const restore = __setSinkForTesting(sink);
    try {
      const handler = withErrorLogging("/api/boom", async () => {
        throw new Error("internal boom");
      });
      const resp = await handler(new Request("http://test/api/boom", { method: "POST" }));
      expect(resp.status).toBe(500);
      const body = await resp.json();
      expect(body.error).toBe("Internal Server Error");
      expect(sink).toHaveBeenCalledTimes(1);
      const logged = sink.mock.calls[0]![0]!;
      expect(logged.message).toBe("internal boom");
      expect(logged.route).toBe("/api/boom");
      expect(logged.stack).toBeTruthy();
    } finally {
      restore();
    }
  });

  it("ignores 4xx responses by default (only >= 500 is a 'failure')", async () => {
    const sink = vi.fn(async () => undefined);
    const restore = __setSinkForTesting(sink);
    try {
      const handler = withErrorLogging("/api/nope", async () => {
        return new Response("bad input", { status: 400 });
      });
      const resp = await handler(new Request("http://test/api/nope"));
      expect(resp.status).toBe(400);
      expect(sink).not.toHaveBeenCalled();
    } finally {
      restore();
    }
  });

  it("respects a custom minStatusForFailure (e.g. log all 4xx too)", async () => {
    const sink = vi.fn(async () => undefined);
    const restore = __setSinkForTesting(sink);
    try {
      const handler = withErrorLogging(
        "/api/strict",
        async () => new Response("bad", { status: 400 }),
        { minStatusForFailure: 400 },
      );
      await handler(new Request("http://test/api/strict"));
      expect(sink).toHaveBeenCalledTimes(1);
      const logged = sink.mock.calls[0]![0]!;
      expect(logged.status_code).toBe(400);
      // 4xx should be logged as "warn" not "error"
      expect(logged.level).toBe("warn");
    } finally {
      restore();
    }
  });

  it("extracts x-request-id and user-agent from request headers", async () => {
    const sink = vi.fn(async () => undefined);
    const restore = __setSinkForTesting(sink);
    try {
      const handler = withErrorLogging("/api/hdr", async () => {
        throw new Error("x");
      });
      await handler(
        new Request("http://test/api/hdr", {
          headers: {
            "x-request-id": "req-42",
            "user-agent": "test-ua",
          },
        }),
      );
      const logged = sink.mock.calls[0]![0]!;
      expect(logged.request_id).toBe("req-42");
      expect(logged.user_agent).toBe("test-ua");
    } finally {
      restore();
    }
  });
});
