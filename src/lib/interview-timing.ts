// ---------------------------------------------------------------------------
// Interview timing helpers
//
// 这些纯函数负责"面试快结束时的收尾"逻辑，和任何 React / RTC side-effect 解耦，
// 方便在 unit test 里覆盖阈值 / 边界条件。
//
// 时间线（以面试总时长 T 秒为基准）：
//   T - TIME_UP_WARNING_LEAD_SECS : 给 AI 推一条 [TIME_UP] 提示，让它说结束语
//   T - TIME_UP_WARNING_LEAD_SECS + (TIME_UP_WARNING_LEAD_SECS + TIME_UP_GRACE_MS/1000)
//     = T + TIME_UP_GRACE_MS/1000 : 真正断开 RTC
// ---------------------------------------------------------------------------

/** 距离面试结束多少秒发送 [TIME_UP] 提示给 AI。 */
export const TIME_UP_WARNING_LEAD_SECS = 10;

/** 收到提示后额外留给 AI 播报致谢的毫秒数。 */
export const TIME_UP_GRACE_MS = 15000;

/** [TIME_UP] 提示文本 —— 作为 ExternalTextToLLM 注入 agent 上下文。 */
export const TIME_UP_PROMPT =
  "[TIME_UP] 面试时间快到了，请立刻用一句话向被面试者表示感谢并自然结束面试，不要再提新问题。";

/**
 * 判断是否应该发送 [TIME_UP] 提示。
 *
 * 规则：
 *  1. 必须正在通话中 (isCalling)
 *  2. 同一次通话只发一次 (!alreadySent)
 *  3. 面试总时长必须 > 前置量，否则没必要提前通知（会被 fallback end 兜底）
 *  4. 已经进入 "T - lead" 窗口
 */
export function shouldSendTimeUpWarning(params: {
  isCalling: boolean;
  alreadySent: boolean;
  elapsedSeconds: number;
  totalSeconds: number;
  leadSecs?: number;
}): boolean {
  const {
    isCalling,
    alreadySent,
    elapsedSeconds,
    totalSeconds,
    leadSecs = TIME_UP_WARNING_LEAD_SECS,
  } = params;

  if (!isCalling) return false;
  if (alreadySent) return false;
  if (!Number.isFinite(totalSeconds) || totalSeconds <= leadSecs) return false;
  if (!Number.isFinite(elapsedSeconds)) return false;

  return elapsedSeconds >= totalSeconds - leadSecs;
}

/**
 * 发送提示后，延迟多少毫秒真正结束通话。
 * 前置量转成 ms 再加上 grace period。
 */
export function computeEndDelayMs(
  leadSecs: number = TIME_UP_WARNING_LEAD_SECS,
  graceMs: number = TIME_UP_GRACE_MS,
): number {
  return leadSecs * 1000 + graceMs;
}

/**
 * 兜底：如果总时长 < 前置量（没发提示）或者提示失败，只要真的超时就直接结束。
 */
export function shouldForceEnd(params: {
  isCalling: boolean;
  endScheduled: boolean;
  elapsedSeconds: number;
  totalSeconds: number;
}): boolean {
  const { isCalling, endScheduled, elapsedSeconds, totalSeconds } = params;
  if (!isCalling) return false;
  if (endScheduled) return false;
  if (!Number.isFinite(totalSeconds) || totalSeconds <= 0) return false;
  return elapsedSeconds >= totalSeconds;
}

/**
 * 把分钟字符串（如 "10"、"10.5"）转成秒数。非法输入返回 0。
 */
export function parseInterviewDurationMinutes(input: unknown): number {
  const n = Number(input);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.round(n * 60);
}
