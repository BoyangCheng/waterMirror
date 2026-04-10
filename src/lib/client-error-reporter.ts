// 浏览器端错误上报：挂 window.onerror / unhandledrejection 监听器，
// 通过 /api/client-errors 持久化到 error_log。
//
// 和 console-logger.ts 的区别：
//  - console-logger 维护内存里的环形缓冲，供 bug report 手动上传
//  - client-error-reporter 每次出错都立刻发一条，自动进入 error_log
//
// 限流：每 1 秒最多 1 条、每个 session 最多 30 条，防止错误循环刷爆 DB。

const MAX_PER_SESSION = 30;
const RATE_LIMIT_MS = 1000;

interface ReportPayload {
  message: string;
  stack?: string;
  kind: "window.onerror" | "unhandledrejection" | "manual";
  pageUrl?: string;
  filename?: string;
  line?: number;
  column?: number;
  extra?: unknown;
}

let installed = false;
let sentCount = 0;
let lastSentAt = 0;

function serializeUnknown(value: unknown): string {
  if (value instanceof Error) return value.message;
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value) ?? String(value);
  } catch {
    return String(value);
  }
}

function extractStack(value: unknown): string | undefined {
  if (value instanceof Error) return value.stack;
  return undefined;
}

export function reportClientError(payload: ReportPayload): void {
  if (typeof window === "undefined") return;
  const now = Date.now();
  if (sentCount >= MAX_PER_SESSION) return;
  if (now - lastSentAt < RATE_LIMIT_MS) return;
  sentCount++;
  lastSentAt = now;

  const body = JSON.stringify({
    ...payload,
    pageUrl: payload.pageUrl ?? window.location.href,
  });

  try {
    // sendBeacon 是最可靠的"页面卸载时也能发"的途径
    if (navigator.sendBeacon) {
      const blob = new Blob([body], { type: "application/json" });
      const ok = navigator.sendBeacon("/api/client-errors", blob);
      if (ok) return;
    }
    // 回退到 fetch keepalive
    fetch("/api/client-errors", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body,
      keepalive: true,
    }).catch(() => {
      // 静默 —— 不能再抛，否则会递归
    });
  } catch {
    // 静默
  }
}

export function installClientErrorReporter(): void {
  if (installed || typeof window === "undefined") return;
  installed = true;

  window.addEventListener("error", (e) => {
    reportClientError({
      kind: "window.onerror",
      message: e.message || serializeUnknown(e.error) || "window.onerror",
      stack: extractStack(e.error),
      filename: e.filename,
      line: e.lineno,
      column: e.colno,
    });
  });

  window.addEventListener("unhandledrejection", (e) => {
    const reason = (e as PromiseRejectionEvent).reason;
    reportClientError({
      kind: "unhandledrejection",
      message: serializeUnknown(reason) || "unhandledrejection",
      stack: extractStack(reason),
    });
  });
}
