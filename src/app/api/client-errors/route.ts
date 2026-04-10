// 接收浏览器端错误上报，写入 error_log。
// 调用方：src/lib/client-error-reporter.ts 通过 fetch keepalive / sendBeacon POST。
//
// 安全/限流考虑：
//  - 只接受白名单字段，body 先限长到 20KB
//  - 调用 recordError 自身有 1s 去重 + 从不 throw
//  - 不返回详细错误信息（避免给攻击者 probe 表结构）

import { NextResponse } from "next/server";
import { recordError } from "@/lib/error-log";

const MAX_BODY_BYTES = 20 * 1024; // 20KB

function clampString(v: unknown, max: number): string | null {
  if (typeof v !== "string") return null;
  if (v.length === 0) return null;
  return v.slice(0, max);
}

export async function POST(req: Request) {
  try {
    // 简单的 body 大小保护 —— 虽然不是完美的 byte-accurate，但能挡住滥用
    const raw = await req.text();
    if (raw.length > MAX_BODY_BYTES) {
      return NextResponse.json({ error: "Payload too large" }, { status: 413 });
    }

    let body: Record<string, unknown> = {};
    try {
      body = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const userAgent = req.headers.get("user-agent");

    await recordError({
      level: "error",
      source: "client",
      route: clampString(body.pageUrl, 500) ?? clampString(body.route, 500),
      message: clampString(body.message, 2000) ?? "Client error",
      stack: clampString(body.stack, 8000),
      userAgent,
      userId: clampString(body.userId, 100),
      orgId: clampString(body.orgId, 100),
      context: {
        kind: clampString(body.kind, 50), // "window.onerror" | "unhandledrejection" | "manual"
        pageUrl: clampString(body.pageUrl, 500),
        filename: clampString(body.filename, 500),
        line: typeof body.line === "number" ? body.line : null,
        column: typeof body.column === "number" ? body.column : null,
        extra: body.extra ?? null,
      },
    });

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err) {
    // 最后兜底：如果连 recordError 都不行（理论上不可能），静默返回 200
    // 避免浏览器看到 500 又上报一次造成循环。
    // biome-ignore lint: last-resort fallback
    console.error("[/api/client-errors] failed:", err);
    return NextResponse.json({ ok: false }, { status: 200 });
  }
}
