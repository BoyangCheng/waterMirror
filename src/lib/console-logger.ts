// 浏览器端 console 拦截器：维护最近 N 条日志的环形缓冲，供 bug 提交时一起上报。
// 在客户端模块加载时调用 installConsoleLogger() 即开始收集。

type LogLevel = "log" | "info" | "warn" | "error" | "debug";

interface LogEntry {
  time: string;
  level: LogLevel;
  message: string;
}

const MAX_LOGS = 200;
const buffer: LogEntry[] = [];
let installed = false;

function safeStringify(value: unknown): string {
  if (typeof value === "string") return value;
  if (value instanceof Error) return `${value.name}: ${value.message}${value.stack ? "\n" + value.stack : ""}`;
  try {
    return JSON.stringify(value, (_k, v) => {
      if (typeof v === "bigint") return v.toString();
      if (v instanceof Error) return `${v.name}: ${v.message}`;
      return v;
    });
  } catch {
    try {
      return String(value);
    } catch {
      return "[Unserializable]";
    }
  }
}

function push(level: LogLevel, args: unknown[]) {
  const message = args.map(safeStringify).join(" ");
  const truncated = message.length > 2000 ? message.slice(0, 2000) + "…(truncated)" : message;
  buffer.push({ time: new Date().toISOString(), level, message: truncated });
  if (buffer.length > MAX_LOGS) {
    buffer.splice(0, buffer.length - MAX_LOGS);
  }
}

export function installConsoleLogger() {
  if (installed || typeof window === "undefined") return;
  installed = true;

  const levels: LogLevel[] = ["log", "info", "warn", "error", "debug"];
  for (const level of levels) {
    const original = console[level].bind(console) as (...args: unknown[]) => void;
    console[level] = (...args: unknown[]) => {
      try {
        push(level, args);
      } catch {
        // ignore
      }
      original(...args);
    };
  }

  window.addEventListener("error", (e) => {
    push("error", [`[window.onerror] ${e.message}`, e.filename ? `@${e.filename}:${e.lineno}:${e.colno}` : ""]);
  });
  window.addEventListener("unhandledrejection", (e) => {
    push("error", ["[unhandledrejection]", (e as PromiseRejectionEvent).reason]);
  });
}

export function getRecentConsoleLogs(limit = MAX_LOGS): LogEntry[] {
  return buffer.slice(-limit);
}
