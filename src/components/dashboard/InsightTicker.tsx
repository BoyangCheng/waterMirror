"use client";

// dashboard 顶部"动态条" ——
// - 拉 /api/org-insights 拿当前 org 的 insights
// - 每 7 秒自动切换下一条，hover 暂停（避免你在读时被切走）
// - 视觉沿用「面试小提示」气泡的紫粉色调 + spring 弹簧动画
// - 没数据时整条不渲染（避免占空间）

import axios from "axios";
import { useEffect, useRef, useState } from "react";

interface Insight {
  id: number;
  insight_type: string;
  text: string;
  emoji: string | null;
}

const ROTATE_INTERVAL_MS = 7000;

export function InsightTicker() {
  const [items, setItems] = useState<Insight[]>([]);
  const [idx, setIdx] = useState(0);
  const [paused, setPaused] = useState(false);
  // animation key：每次切换 +1 触发 React 重新挂载，让 CSS animation 重跑
  const [animKey, setAnimKey] = useState(0);
  const rotateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 初次加载
  useEffect(() => {
    axios
      .get<{ insights: Insight[] }>("/api/org-insights")
      .then((res) => setItems(res.data.insights ?? []))
      .catch(() => {});
  }, []);

  // 自动轮播：paused 时不切；只有 1 条也不切
  useEffect(() => {
    if (paused || items.length <= 1) return;
    if (rotateTimerRef.current) clearTimeout(rotateTimerRef.current);
    rotateTimerRef.current = setTimeout(() => {
      setIdx((i) => (i + 1) % items.length);
      setAnimKey((k) => k + 1);
    }, ROTATE_INTERVAL_MS);
    return () => {
      if (rotateTimerRef.current) clearTimeout(rotateTimerRef.current);
    };
  }, [idx, paused, items.length]);

  if (items.length === 0) return null;
  const current = items[idx % items.length];

  // 不再自带 outer w-full 容器：由调用方决定如何放置（一般紧跟 dashboard 标题同行）
  // 字号从 text-sm → text-base，更醒目
  return (
    <div
      className="relative inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-gradient-to-r from-indigo-50 via-purple-50 to-pink-50 border border-indigo-200/80 text-indigo-900 text-base font-normal shadow-[0_4px_12px_-2px_rgba(99,102,241,0.18)] max-w-full"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {/* key 触发动画重跑；emoji 单独 wiggle 抖动 */}
      <span key={`emoji-${animKey}`} className="tip-emoji text-lg leading-none flex-none">
        {current.emoji ?? "💡"}
      </span>
      <span
        key={`text-${animKey}`}
        className="truncate animate-in fade-in slide-in-from-bottom-1 duration-500"
      >
        {current.text}
      </span>
      {/* 进度小点（仅当有多条时显示）—— 可点击跳转到对应 insight
          点击时清掉自动轮播 timer 防止瞬间被覆盖,触发动画重跑 */}
      {items.length > 1 && (
        <span className="ml-2 flex items-center gap-1.5 flex-none">
          {items.map((_, i) => {
            const active = i === idx % items.length;
            return (
              <button
                key={i}
                type="button"
                aria-label={`第 ${i + 1} 条小提示`}
                onClick={() => {
                  if (rotateTimerRef.current) clearTimeout(rotateTimerRef.current);
                  setIdx(i);
                  setAnimKey((k) => k + 1);
                }}
                className={`w-2 h-2 rounded-full transition-all hover:scale-150 cursor-pointer ${
                  active ? "bg-indigo-500" : "bg-indigo-200 hover:bg-indigo-400"
                }`}
              />
            );
          })}
        </span>
      )}
    </div>
  );
}
