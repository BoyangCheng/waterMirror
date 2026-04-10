// ---------------------------------------------------------------------------
// error-log.ts
//
// 把运行时错误和失败的 response 写入 error_log 表。
//
// 设计要点：
//  1. **Fire-and-forget**：写入是 async、从不 throw。任何写入失败只会走
//     console.error，绝对不会再次触发记录（防止递归）。
//  2. **纯函数优先**：normalize/truncate/safeStringify 是纯函数，Unit test 覆盖。
//  3. **可注入 sink**：生产环境用 Postgres sink，测试时通过 __setSinkForTesting
//     换成内存 sink。主代码里永远不 import 真实 DB（ESM 懒加载）。
//  4. **API 路由包装**：withErrorLogging(routeName, handler) 同时捕获
//     thrown exception 和 >= 500 的 response，都持久化到 DB。
//  5. **轻量 rate-limit**：同一 message+route 组合 1 秒内只记一次，防止
//     流量高峰时 DB 被同一错误刷爆。
// ---------------------------------------------------------------------------

export type ErrorLogLevel = "error" | "warn" | "fatal";
export type ErrorLogSource = "api" | "client" | "service" | "background";

export interface ErrorLogInput {
  /** 默认 "error" */
  level?: ErrorLogLevel;
  /** 必填：错误来源域 */
  source: ErrorLogSource;
  /** API 路径、组件路径、任务名等 */
  route?: string | null;
  /** 必填：人类可读的一句话。如果留空会从 `error` 里尝试抽取 */
  message?: string;
  /** 栈信息。留空会从 `error` 里抽 */
  stack?: string | null;
  /** 如果是 API 失败，填 HTTP status */
  statusCode?: number | null;
  userId?: string | null;
  orgId?: string | null;
  requestId?: string | null;
  userAgent?: string | null;
  /** 任意补充数据 —— 会走 safeStringify，不必担心 circular ref */
  context?: Record<string, unknown> | null;
  /** 原始 Error 对象（推荐直接传，normalize 会自动抽 message/stack） */
  error?: unknown;
}

export interface NormalizedErrorLogEntry {
  level: ErrorLogLevel;
  source: ErrorLogSource;
  route: string | null;
  message: string;
  stack: string | null;
  status_code: number | null;
  user_id: string | null;
  org_id: string | null;
  request_id: string | null;
  environment: string;
  user_agent: string | null;
  context: Record<string, unknown> | null;
}

// ---------------------------------------------------------------------------
// 纯工具函数
// ---------------------------------------------------------------------------

/** 最大字段长度，避免单条日志把 DB 塞爆。与 console-logger 的 2000 保持一致。 */
export const MAX_MESSAGE_LEN = 2000;
export const MAX_STACK_LEN = 8000;
export const MAX_CONTEXT_JSON_LEN = 8000;

export function truncate(value: string, max: number): string {
  if (value.length <= max) return value;
  return value.slice(0, max) + "…(truncated)";
}

/** 序列化任意值，处理 bigint / Error / 循环引用。不会抛。 */
export function safeStringify(value: unknown): string {
  if (value === null || value === undefined) return String(value);
  if (typeof value === "string") return value;
  if (value instanceof Error) {
    return `${value.name}: ${value.message}${value.stack ? "\n" + value.stack : ""}`;
  }
  const seen = new WeakSet<object>();
  try {
    return JSON.stringify(value, (_k, v) => {
      if (typeof v === "bigint") return v.toString();
      if (v instanceof Error) return `${v.name}: ${v.message}`;
      if (typeof v === "function") return "[Function]";
      if (typeof v === "object" && v !== null) {
        if (seen.has(v)) return "[Circular]";
        seen.add(v);
      }
      return v;
    }) ?? "";
  } catch {
    try {
      return String(value);
    } catch {
      return "[Unserializable]";
    }
  }
}

/**
 * 从任意输入构造一条标准化的 error_log 记录。
 * 纯函数 —— Unit test 会覆盖所有分支。
 */
export function normalizeErrorLogEntry(input: ErrorLogInput): NormalizedErrorLogEntry {
  const raw = input.error;
  const isErrorLike = raw instanceof Error;

  const rawMessage =
    input.message ??
    (isErrorLike ? raw.message : undefined) ??
    (typeof raw === "string" ? raw : undefined) ??
    (raw != null ? safeStringify(raw) : undefined) ??
    "Unknown error";

  const rawStack =
    input.stack ??
    (isErrorLike ? raw.stack ?? null : null);

  // 限长，防止 context 里意外塞了巨型 object / base64 图片
  let truncatedContext: Record<string, unknown> | null = null;
  if (input.context) {
    const json = safeStringify(input.context);
    if (json.length <= MAX_CONTEXT_JSON_LEN) {
      // 原样保留，让 DB 端做 JSONB 解析
      truncatedContext = input.context;
    } else {
      truncatedContext = {
        _truncated: true,
        _originalLength: json.length,
        preview: truncate(json, MAX_CONTEXT_JSON_LEN),
      };
    }
  }

  return {
    level: input.level ?? "error",
    source: input.source,
    route: input.route ?? null,
    message: truncate(rawMessage, MAX_MESSAGE_LEN),
    stack: rawStack ? truncate(rawStack, MAX_STACK_LEN) : null,
    status_code: input.statusCode ?? null,
    user_id: input.userId ?? null,
    org_id: input.orgId ?? null,
    request_id: input.requestId ?? null,
    environment: process.env.NODE_ENV ?? "development",
    user_agent: input.userAgent ?? null,
    context: truncatedContext,
  };
}

// ---------------------------------------------------------------------------
// Rate-limit：同一 message+route 组合 1 秒内最多记一次
// ---------------------------------------------------------------------------

const DEDUP_WINDOW_MS = 1000;
const dedupCache = new Map<string, number>();
const DEDUP_MAX_ENTRIES = 500;

export function shouldDedupe(
  entry: NormalizedErrorLogEntry,
  now: number = Date.now(),
): boolean {
  const key = `${entry.source}|${entry.route ?? ""}|${entry.message}`;
  const last = dedupCache.get(key);
  if (last !== undefined && now - last < DEDUP_WINDOW_MS) {
    return true;
  }
  dedupCache.set(key, now);
  if (dedupCache.size > DEDUP_MAX_ENTRIES) {
    // 清掉超过窗口的 entry —— 简单 LRU 替代
    const cutoff = now - DEDUP_WINDOW_MS;
    const toDelete: string[] = [];
    dedupCache.forEach((t, k) => {
      if (t < cutoff) toDelete.push(k);
    });
    for (const k of toDelete) dedupCache.delete(k);
  }
  return false;
}

/** 仅供 test 使用：清空 dedup 缓存 */
export function __resetDedupForTesting(): void {
  dedupCache.clear();
}

// ---------------------------------------------------------------------------
// Sink：把 normalized entry 写到某个地方。默认 DB sink 只在 server 端工作。
// ---------------------------------------------------------------------------

export type ErrorLogSink = (entry: NormalizedErrorLogEntry) => Promise<void>;

// 默认 sink：ESM 懒加载 @/lib/db，避免在浏览器端打包时把 postgres 驱动带进去。
async function defaultDbSink(entry: NormalizedErrorLogEntry): Promise<void> {
  if (typeof window !== "undefined") {
    // 浏览器端不应该直连 DB —— 客户端错误走 /api/client-errors
    return;
  }
  const { default: sql } = await import("@/lib/db");
  await sql`
    INSERT INTO error_log (
      level, source, route, message, stack, status_code,
      user_id, org_id, request_id, environment, user_agent, context
    ) VALUES (
      ${entry.level}, ${entry.source}, ${entry.route}, ${entry.message},
      ${entry.stack}, ${entry.status_code}, ${entry.user_id}, ${entry.org_id},
      ${entry.request_id}, ${entry.environment}, ${entry.user_agent},
      ${entry.context as unknown as string /* postgres.js 会把 object 当 jsonb 处理 */}
    )
  `;
}

let activeSink: ErrorLogSink = defaultDbSink;

/** 仅供 test 使用：替换 sink 为内存 sink 便于断言。 */
export function __setSinkForTesting(sink: ErrorLogSink): () => void {
  const prev = activeSink;
  activeSink = sink;
  return () => {
    activeSink = prev;
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * 记录一条错误到 error_log。**永远不会抛出**。
 * 调用方不需要 await —— 但 await 也是安全的，返回的 Promise 一定 resolve。
 */
export async function recordError(input: ErrorLogInput): Promise<void> {
  let entry: NormalizedErrorLogEntry;
  try {
    entry = normalizeErrorLogEntry(input);
  } catch (normalizeErr) {
    // 兜底：normalize 都挂了只打印 console，不能再走 recordError
    try {
      // biome-ignore lint: last-resort fallback
      console.error("[error-log] normalize failed:", normalizeErr);
    } catch {}
    return;
  }

  if (shouldDedupe(entry)) return;

  try {
    await activeSink(entry);
  } catch (sinkErr) {
    try {
      // biome-ignore lint: last-resort fallback - NEVER call recordError here
      console.error("[error-log] sink failed for", entry.message, sinkErr);
    } catch {}
  }
}

// ---------------------------------------------------------------------------
// withErrorLogging：包装 Next.js API route handler
// ---------------------------------------------------------------------------

export interface WithErrorLoggingOptions {
  /** 出现 >= minStatusForFailure 的 response 时也记录。默认 500。 */
  minStatusForFailure?: number;
  /** 来源标签，默认 "api" */
  source?: ErrorLogSource;
}

type RouteHandler = (req: Request, ...rest: unknown[]) => Promise<Response>;

/**
 * 包装一个 Next.js route handler：
 *   - 捕获 thrown error → recordError + 返回 500 JSON
 *   - 捕获返回的 failure response (>= 500) → recordError
 *
 * 使用示例：
 *   export const POST = withErrorLogging("/api/foo", async (req) => { ... });
 */
export function withErrorLogging<H extends RouteHandler>(
  routeName: string,
  handler: H,
  options: WithErrorLoggingOptions = {},
): H {
  const minFailStatus = options.minStatusForFailure ?? 500;
  const source = options.source ?? "api";

  const wrapped = async (req: Request, ...rest: unknown[]): Promise<Response> => {
    const requestId = req.headers.get("x-request-id") ?? null;
    const userAgent = req.headers.get("user-agent") ?? null;

    try {
      const resp = await handler(req, ...rest);
      if (resp.status >= minFailStatus) {
        // 不要消费 response body —— 克隆后读一份做 preview
        let bodyPreview: string | null = null;
        try {
          bodyPreview = truncate(await resp.clone().text(), 500);
        } catch {}
        void recordError({
          level: resp.status >= 500 ? "error" : "warn",
          source,
          route: routeName,
          message: `HTTP ${resp.status} from ${routeName}`,
          statusCode: resp.status,
          requestId,
          userAgent,
          context: { bodyPreview },
        });
      }
      return resp;
    } catch (err) {
      void recordError({
        level: "error",
        source,
        route: routeName,
        error: err,
        statusCode: 500,
        requestId,
        userAgent,
        context: { method: req.method, url: req.url },
      });
      // 返回通用 500，避免把内部错误回写给客户端
      return new Response(
        JSON.stringify({ error: "Internal Server Error", requestId }),
        { status: 500, headers: { "content-type": "application/json" } },
      );
    }
  };

  return wrapped as H;
}
