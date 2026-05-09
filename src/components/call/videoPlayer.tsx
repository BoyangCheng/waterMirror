"use client";

import { Maximize2, Pause, Play, Video as VideoIcon } from "lucide-react";
import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";

/**
 * 内嵌视频播放器 —— 不再是浮动窗，作为左侧栏的常驻槽位渲染
 *
 * 三种 UI 状态：
 *   1. src 为 null            → 浅色占位框 + "无视频"提示（候选人没开摄像头/上传失败）
 *   2. src 存在但 isOpen=false → 浅色占位 + 大 Play 按钮（用户点了再加载）
 *   3. isOpen=true            → 实际 <video> + 自定义控件（暗色玻璃质感）
 *
 * 关键设计：
 *   - WebM + append 流式上传缺尾部 SeekHead，浏览器 video.duration 不可靠
 *     → 用 DB 给的 durationMs 渲染进度条
 *   - 进度条上叠加 Q/A markers：小竖线指示每个问答开始时刻，点击跳转
 *   - 占满父容器宽度（w-full），高度按 3:4 录像比例自动算
 */

export interface VideoPlayerHandle {
  seek: (seconds: number) => void;
  pause: () => void;
}

interface QaMarker {
  /** 这个 marker 对应的 turn 在录像中的偏移（ms） */
  offsetMs: number;
  /** "agent" or "user"，用于 marker 上色区分提问/回答 */
  role: "agent" | "user";
}

interface Props {
  /** null = 没有可播放的视频，渲染"无视频"占位 */
  src: string | null;
  /** 是否打开播放（false 时显示占位 + Play 按钮） */
  isOpen: boolean;
  /** 用户在占位上点 Play 时通知外层 */
  onOpen: () => void;
  /** DB 存的真实时长（ms）。给 0/undefined 时退回浏览器自报 video.duration */
  durationMs?: number;
  /** 用户从外层（Q/A 列表）点击触发的初始跳转点（秒） */
  initialSeekSeconds?: number;
  /** Q/A 时间戳列表，画在进度条上当 markers */
  markers?: QaMarker[];
  /** 当前活跃 marker（外层根据 currentSec 算出来传进来），高亮 */
  activeMarkerIndex?: number;
  onTimeUpdate?: (currentSeconds: number) => void;
  onError?: () => void;
  /** 用户点 marker 时通知外层（外层切到对应 Q/A 高亮） */
  onMarkerClick?: (markerIndex: number) => void;
}

const SPEED_OPTIONS = [0.75, 1, 1.25, 1.5, 2];

const VideoPlayer = forwardRef<VideoPlayerHandle, Props>(
  (
    {
      src,
      isOpen,
      onOpen,
      durationMs,
      initialSeekSeconds = 0,
      markers,
      activeMarkerIndex,
      onTimeUpdate,
      onError,
      onMarkerClick,
    },
    ref,
  ) => {
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const progressBarRef = useRef<HTMLDivElement | null>(null);

    const [hasError, setHasError] = useState(false);
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentSec, setCurrentSec] = useState(0);
    const [browserDuration, setBrowserDuration] = useState<number>(0);
    const [speed, setSpeed] = useState<number>(1);
    const [showSpeedMenu, setShowSpeedMenu] = useState(false);

    const totalSec =
      durationMs && durationMs > 0
        ? durationMs / 1000
        : Number.isFinite(browserDuration) && browserDuration > 0
          ? browserDuration
          : 0;

    useImperativeHandle(ref, () => ({
      seek: (seconds: number) => {
        const v = videoRef.current;
        if (!v) return;
        try {
          v.currentTime = Math.max(0, seconds);
          if (v.paused) void v.play().catch(() => {});
        } catch {
          /* readyState 不够时会抛，忽略 */
        }
      },
      pause: () => videoRef.current?.pause(),
    }));

    const handleLoadedMetadata = () => {
      const v = videoRef.current;
      if (!v) return;
      if (Number.isFinite(v.duration) && v.duration > 0) {
        setBrowserDuration(v.duration);
      }
      if (initialSeekSeconds > 0) {
        try {
          v.currentTime = initialSeekSeconds;
        } catch {
          /* ignore */
        }
      }
    };

    // src 切换时重置状态（不同候选人的视频切换）
    useEffect(() => {
      setHasError(false);
      setIsPlaying(false);
      setCurrentSec(0);
      setBrowserDuration(0);
    }, [src]);

    const togglePlay = () => {
      const v = videoRef.current;
      if (!v) return;
      if (v.paused) v.play().catch(() => {});
      else v.pause();
    };

    const goFullscreen = () => {
      const v = videoRef.current;
      if (!v) return;
      const anyV = v as any;
      if (v.requestFullscreen) v.requestFullscreen().catch(() => {});
      else if (anyV.webkitRequestFullscreen) anyV.webkitRequestFullscreen();
    };

    const changeSpeed = (s: number) => {
      const v = videoRef.current;
      if (v) v.playbackRate = s;
      setSpeed(s);
      setShowSpeedMenu(false);
    };

    const onProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
      const v = videoRef.current;
      const bar = progressBarRef.current;
      if (!v || !bar || totalSec <= 0) return;
      const rect = bar.getBoundingClientRect();
      const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      v.currentTime = ratio * totalSec;
    };

    // ============ 状态 1：src 为 null —— 没有视频，纯占位 ============
    if (!src) {
      return (
        <div className="w-full bg-slate-50 border-2 border-dashed border-slate-200 rounded-xl flex flex-col items-center justify-center text-slate-400 py-8 px-4">
          <VideoIcon size={28} className="mb-2 opacity-50" />
          <p className="text-xs text-center">无视频</p>
          <p className="text-[10px] text-center mt-1 text-slate-300">
            候选人未开启摄像头或上传失败
          </p>
        </div>
      );
    }

    // ============ 状态 2：未打开 —— 浅色占位 + Play 按钮（懒加载） ============
    if (!isOpen) {
      return (
        <button
          type="button"
          onClick={onOpen}
          className="w-full aspect-[3/4] bg-gradient-to-br from-slate-100 to-slate-200 hover:from-slate-200 hover:to-slate-300 border border-slate-300 rounded-xl flex flex-col items-center justify-center transition-all group cursor-pointer"
        >
          <div className="w-12 h-12 rounded-full bg-white/80 group-hover:bg-white shadow-md flex items-center justify-center transition-all group-hover:scale-110">
            <Play size={24} className="text-indigo-600 ml-1" fill="currentColor" />
          </div>
          <p className="text-xs text-slate-500 mt-3 font-medium">面试视频回放</p>
          {durationMs && durationMs > 0 && (
            <p className="text-[10px] text-slate-400 mt-1 font-mono">
              {formatSec(durationMs / 1000)}
            </p>
          )}
        </button>
      );
    }

    // ============ 状态 3：打开 —— 完整播放器 ============
    return (
      <div className="w-full bg-gradient-to-b from-gray-900 to-gray-800 rounded-xl shadow-lg border border-gray-700 overflow-hidden">
        {hasError ? (
          <div className="w-full aspect-[3/4] bg-black text-gray-400 text-sm flex items-center justify-center text-center px-4">
            视频文件无法加载
          </div>
        ) : (
          <video
            ref={videoRef}
            src={src}
            preload="metadata"
            autoPlay
            onLoadedMetadata={handleLoadedMetadata}
            onTimeUpdate={(e) => {
              const t = (e.target as HTMLVideoElement).currentTime;
              setCurrentSec(t);
              onTimeUpdate?.(t);
            }}
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
            onError={() => {
              setHasError(true);
              onError?.();
            }}
            onClick={togglePlay}
            className="w-full aspect-[3/4] object-cover bg-black cursor-pointer block"
          />
        )}

        {!hasError && (
          <div className="bg-gray-900/95 px-3 py-2.5 backdrop-blur-sm">
            {/* 进度条 + Q/A markers */}
            <div className="relative">
              <div
                ref={progressBarRef}
                className="h-1.5 bg-gray-700 rounded-full cursor-pointer relative group"
                onClick={onProgressClick}
              >
                <div
                  className="h-full bg-indigo-500 rounded-full transition-[width] duration-100 ease-linear"
                  style={{
                    width:
                      totalSec > 0
                        ? `${Math.min(100, (currentSec / totalSec) * 100)}%`
                        : "0%",
                  }}
                />
                <div
                  className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3 h-3 bg-indigo-400 rounded-full opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
                  style={{
                    left:
                      totalSec > 0
                        ? `${Math.min(100, (currentSec / totalSec) * 100)}%`
                        : "0%",
                  }}
                />
              </div>

              {/* Q/A markers 叠加在进度条上：紫色=AI 提问，绿色=候选人回答 */}
              {markers && markers.length > 0 && totalSec > 0 && (
                <div className="absolute inset-0 pointer-events-none">
                  {markers.map((m, i) => {
                    const ratio = Math.min(1, m.offsetMs / 1000 / totalSec);
                    if (ratio < 0 || ratio > 1) return null;
                    const isActive = i === activeMarkerIndex;
                    return (
                      <button
                        key={`${i}-${m.offsetMs}`}
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onMarkerClick?.(i);
                        }}
                        className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 pointer-events-auto"
                        style={{ left: `${ratio * 100}%` }}
                        title={`${m.role === "agent" ? "提问" : "回答"} @ ${formatSec(m.offsetMs / 1000)}`}
                      >
                        <div
                          className={`w-[3px] h-3 rounded-sm transition-all ${
                            isActive
                              ? m.role === "agent"
                                ? "bg-indigo-300 scale-y-150"
                                : "bg-emerald-300 scale-y-150"
                              : m.role === "agent"
                                ? "bg-indigo-200/70"
                                : "bg-emerald-200/70"
                          }`}
                        />
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="flex items-center justify-between mt-2">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="text-white hover:text-indigo-400 transition-colors"
                  onClick={togglePlay}
                  title={isPlaying ? "暂停" : "播放"}
                >
                  {isPlaying ? <Pause size={16} /> : <Play size={16} />}
                </button>
                <span className="text-[11px] text-gray-300 font-mono tabular-nums">
                  {formatSec(currentSec)} / {formatSec(totalSec)}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <div className="relative">
                  <button
                    type="button"
                    className="text-[11px] text-gray-300 hover:text-white px-1.5 py-0.5 rounded bg-gray-800 hover:bg-gray-700 transition-colors font-mono"
                    onClick={() => setShowSpeedMenu((v) => !v)}
                    title="倍速"
                  >
                    {speed}×
                  </button>
                  {showSpeedMenu && (
                    <div className="absolute right-0 bottom-full mb-1 bg-gray-800 border border-gray-700 rounded shadow-lg overflow-hidden z-10">
                      {SPEED_OPTIONS.map((s) => (
                        <button
                          key={s}
                          type="button"
                          className={`block w-full text-left px-3 py-1 text-xs font-mono transition-colors ${
                            s === speed
                              ? "bg-indigo-600 text-white"
                              : "text-gray-200 hover:bg-gray-700"
                          }`}
                          onClick={() => changeSpeed(s)}
                        >
                          {s}×
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  className="text-gray-400 hover:text-white transition-colors"
                  onClick={goFullscreen}
                  title="全屏"
                >
                  <Maximize2 size={14} />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  },
);

VideoPlayer.displayName = "VideoPlayer";

export default VideoPlayer;

function formatSec(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return "0:00";
  const total = Math.floor(sec);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}
