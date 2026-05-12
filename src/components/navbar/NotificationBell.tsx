"use client";

// 通知铃 ——
// - 顶部 navbar 右侧，候选人完成面试 / 高分提醒等出现在这里
// - 数据从 /api/notifications 拉，不存独立 notifications 表（直接聚合 response）
// - 已读语义复用 response.is_viewed 字段
// - 60s 轮询一次，开关闭弹层时也立即刷新
//
// 不引入 popover 依赖：用纯 div + 点击外部关闭 listener（沿用 navbar dropdown 风格）

import { useI18n } from "@/i18n";
import axios from "axios";
import { Bell, Check, MessageSquare, Star } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

interface Notification {
  id: number;
  type: "completed" | "high_score";
  candidateName: string;
  interviewName: string;
  interviewId: string;
  callId: string | null;
  score: number | null;
  isRead: boolean;
  createdAt: string;
}

const POLL_INTERVAL_MS = 60_000;

// 接收已 localized 的 4 个文案碎片，避免 t() 严格类型穿透到泛用 helper
function formatRelative(
  iso: string,
  labels: { justNow: string; minAgo: string; hourAgo: string; dayAgo: string },
): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60_000);
  if (min < 1) return labels.justNow;
  if (min < 60) return `${min} ${labels.minAgo}`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} ${labels.hourAgo}`;
  const day = Math.floor(hr / 24);
  return `${day} ${labels.dayAgo}`;
}

export function NotificationBell() {
  const { t } = useI18n();
  const router = useRouter();
  const [items, setItems] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await axios.get<{ notifications: Notification[]; unreadCount: number }>(
        "/api/notifications",
      );
      setItems(res.data.notifications ?? []);
      setUnread(res.data.unreadCount ?? 0);
    } catch {
      // silently fail —— 通知是辅助 UI 不能阻塞主流程
    }
  }, []);

  // 初次加载 + 60s 轮询
  useEffect(() => {
    fetchNotifications();
    const id = setInterval(fetchNotifications, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [fetchNotifications]);

  // 打开弹层立即刷新一次（避免上次轮询过去后久未更新）
  useEffect(() => {
    if (open) fetchNotifications();
  }, [open, fetchNotifications]);

  // 点击外部关闭
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const handleItemClick = async (n: Notification) => {
    setOpen(false);
    // 乐观更新：UI 先标已读，请求失败也不撤回（用户体验优先）
    if (!n.isRead) {
      setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, isRead: true } : x)));
      setUnread((c) => Math.max(0, c - 1));
      axios.post("/api/notifications/mark-read", { responseId: n.id }).catch(() => {});
    }
    router.push(`/interviews/${n.interviewId}`);
  };

  const handleMarkAllRead = async () => {
    if (unread === 0) return;
    setItems((prev) => prev.map((x) => ({ ...x, isRead: true })));
    setUnread(0);
    try {
      await axios.post("/api/notifications/mark-read", { all: true });
    } catch {
      // ignore
    }
  };

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative flex items-center justify-center w-9 h-9 rounded-lg text-gray-600 hover:bg-slate-200 transition-colors"
        aria-label={t("notifications.title")}
      >
        <Bell size={18} />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center leading-none">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-96 max-w-[calc(100vw-2rem)] bg-white border border-gray-100 rounded-xl shadow-xl z-50 overflow-hidden">
          {/* 顶部 header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-gray-900">
                {t("notifications.title")}
              </h3>
              {unread > 0 && (
                <span className="text-xs px-1.5 py-0.5 rounded-full bg-indigo-100 text-indigo-700 font-medium">
                  {unread}
                </span>
              )}
            </div>
            {unread > 0 && (
              <button
                type="button"
                onClick={handleMarkAllRead}
                className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 transition-colors"
              >
                <Check size={12} />
                {t("notifications.markAllRead")}
              </button>
            )}
          </div>

          {/* 列表 */}
          <div className="max-h-[420px] overflow-y-auto">
            {items.length === 0 ? (
              <div className="py-12 text-center text-sm text-gray-400">
                {t("notifications.empty")}
              </div>
            ) : (
              items.map((n) => {
                const Icon = n.type === "high_score" ? Star : MessageSquare;
                const iconColor =
                  n.type === "high_score" ? "text-amber-500" : "text-indigo-500";
                return (
                  <button
                    type="button"
                    key={n.id}
                    onClick={() => handleItemClick(n)}
                    className={`w-full text-left flex items-start gap-3 px-4 py-3 border-b border-gray-50 last:border-b-0 transition-colors ${
                      n.isRead ? "hover:bg-gray-50" : "bg-indigo-50/40 hover:bg-indigo-50"
                    }`}
                  >
                    <div
                      className={`flex-none mt-0.5 w-8 h-8 rounded-full flex items-center justify-center ${
                        n.type === "high_score" ? "bg-amber-50" : "bg-indigo-50"
                      }`}
                    >
                      <Icon size={16} className={iconColor} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p
                        className={`text-sm leading-tight ${
                          n.isRead ? "text-gray-700 font-normal" : "text-gray-900 font-medium"
                        }`}
                      >
                        <span className="font-semibold">{n.candidateName}</span>
                        {" "}
                        {n.type === "high_score"
                          ? t("notifications.highScoreInPrefix")
                          : t("notifications.completedPrefix")}
                        {" "}
                        <span className="text-indigo-700">「{n.interviewName}」</span>
                        {" "}
                        {n.type === "high_score"
                          ? t("notifications.highScoreInSuffix")
                          : t("notifications.completedSuffix")}
                      </p>
                      <p className="text-xs text-gray-400 mt-1">
                        {formatRelative(n.createdAt, {
                          justNow: t("notifications.justNow"),
                          minAgo: t("notifications.minAgo"),
                          hourAgo: t("notifications.hourAgo"),
                          dayAgo: t("notifications.dayAgo"),
                        })}
                        {n.score !== null && (
                          <>
                            {" · "}
                            <span className={n.type === "high_score" ? "text-amber-600 font-medium" : ""}>
                              {n.score} {t("notifications.scoreSuffix")}
                            </span>
                          </>
                        )}
                      </p>
                    </div>
                    {!n.isRead && (
                      <span className="flex-none w-2 h-2 mt-2 rounded-full bg-indigo-500" />
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
