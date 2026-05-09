// ---------------------------------------------------------------------------
// 面试转录的 turn 聚合
//
// 字幕流来一句就 push 一句，但同一 role 连续多句应该算"一个 turn"，方便：
//   - UI 把"AI 一段话被字幕拆成 3 句"显示成一段
//   - 时间戳：一个 turn 只记**第一句**的 offsetMs（用户明确要求："如果 ai 的
//     问题被我们合并，则只记录最开始的 offset"）
//   - 视频回放：点 turn 跳转到那一刻
// ---------------------------------------------------------------------------

export type TranscriptEntry = {
  role: "agent" | "user";
  content: string;
  /** 相对录像 0 时刻（或面试开始）的毫秒 offset */
  offsetMs: number;
};

/**
 * 给已有 turn 列表追加一句话。
 * - 如果上一个 turn 是同一 role：追加到 content（不新增 entry，offsetMs 保持首句时间）
 * - 否则 push 新 entry，offsetMs = nowMs - anchorMs
 *
 * 直接 mutate 入参 `turns` 并返回（与 React useRef 结构兼容）。
 */
export function appendTurn(
  turns: TranscriptEntry[],
  role: "agent" | "user",
  text: string,
  nowMs: number,
  anchorMs: number,
): TranscriptEntry[] {
  const last = turns[turns.length - 1];
  if (last && last.role === role) {
    last.content = last.content + (last.content ? " " : "") + text;
    return turns;
  }
  turns.push({
    role,
    content: text,
    offsetMs: Math.max(0, nowMs - anchorMs),
  });
  return turns;
}

/**
 * 给定视频当前时间，找出该时刻"正在被说"的 turn 下标。
 * 规则：返回最新一个 offsetMs/1000 ≤ currentSeconds 的 entry index。
 * 没有任何 entry 满足时返回 -1（视频还没开始播 / 列表为空）。
 */
export function findActiveTurnIndex(
  turns: ReadonlyArray<{ offsetMs: number }>,
  currentSeconds: number,
): number {
  if (turns.length === 0) return -1;
  let idx = -1;
  for (let i = 0; i < turns.length; i++) {
    if (turns[i].offsetMs / 1000 <= currentSeconds) idx = i;
    else break; // 假定 turns 按 offsetMs 升序
  }
  return idx;
}

/**
 * 把毫秒 offset 格式化为 "m:ss"，给字幕展示。
 */
export function formatOffset(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}
