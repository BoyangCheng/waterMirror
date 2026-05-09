// ---------------------------------------------------------------------------
// Component test for src/components/call/videoPlayer.tsx
//
// jsdom 不真正解码视频，所以这里只测：
//   - 三种 UI 状态切换（无视频占位 / 未打开占位 / 打开后播放器）
//   - imperative handle .seek() 真的会修改 video.currentTime
//   - durationMs 决定进度条显示
//   - 倍速选择 + 播放/暂停按钮
//   - markers 渲染 + 点击触发 onMarkerClick
//   - <video> onError 触发 onError 回调 + 切换到 fallback 提示
// 真实播放/横竖屏自适应留给手测或 e2e。
// ---------------------------------------------------------------------------

import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createRef } from "react";
import VideoPlayer, { type VideoPlayerHandle } from "@/components/call/videoPlayer";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("VideoPlayer — UI 状态分支", () => {
  it("src 为 null → 显示'无视频'占位", () => {
    render(<VideoPlayer src={null} isOpen={false} onOpen={() => {}} />);
    expect(screen.getByText("无视频")).toBeInTheDocument();
    expect(screen.getByText(/未开启摄像头/)).toBeInTheDocument();
    // 不应该有 video 元素
    expect(document.querySelector("video")).toBeNull();
  });

  it("src 存在但 isOpen=false → 显示带 Play 按钮的浅色占位（懒加载，video 不挂载）", () => {
    render(<VideoPlayer src="https://x/v.webm" isOpen={false} onOpen={() => {}} />);
    expect(screen.getByText("面试视频回放")).toBeInTheDocument();
    expect(document.querySelector("video")).toBeNull();
  });

  it("点击占位上的 Play 按钮触发 onOpen", () => {
    const onOpen = vi.fn();
    render(<VideoPlayer src="https://x/v.webm" isOpen={false} onOpen={onOpen} />);
    fireEvent.click(screen.getByRole("button"));
    expect(onOpen).toHaveBeenCalledOnce();
  });

  it("isOpen=true → 挂载 video 元素 + 控件区", () => {
    const { container } = render(
      <VideoPlayer src="https://x/v.webm" isOpen={true} onOpen={() => {}} />,
    );
    expect(container.querySelector("video")).toBeTruthy();
    expect(screen.getByTitle("全屏")).toBeInTheDocument();
    expect(screen.getByTitle("倍速")).toBeInTheDocument();
  });

  it("durationMs 决定时间显示（不依赖浏览器 video.duration）", () => {
    render(
      <VideoPlayer
        src="https://x/v.webm"
        isOpen={true}
        onOpen={() => {}}
        durationMs={185_000}
      />,
    );
    expect(screen.getByText(/0:00 \/ 3:05/)).toBeInTheDocument();
  });
});

describe("VideoPlayer — imperative handle", () => {
  it("暴露 seek + pause", () => {
    const ref = createRef<VideoPlayerHandle>();
    render(<VideoPlayer ref={ref} src="x" isOpen={true} onOpen={() => {}} />);
    expect(ref.current).not.toBeNull();
    expect(typeof ref.current!.seek).toBe("function");
    expect(typeof ref.current!.pause).toBe("function");
  });

  it("seek(N) 修改 video.currentTime", () => {
    const ref = createRef<VideoPlayerHandle>();
    const { container } = render(
      <VideoPlayer ref={ref} src="x" isOpen={true} onOpen={() => {}} />,
    );
    const video = container.querySelector("video") as HTMLVideoElement;
    (video as any).play = vi.fn().mockResolvedValue(undefined);
    ref.current!.seek(7.5);
    expect(video.currentTime).toBe(7.5);
  });

  it("seek(负数) 钳制为 0，不抛错", () => {
    const ref = createRef<VideoPlayerHandle>();
    const { container } = render(
      <VideoPlayer ref={ref} src="x" isOpen={true} onOpen={() => {}} />,
    );
    const video = container.querySelector("video") as HTMLVideoElement;
    (video as any).play = vi.fn().mockResolvedValue(undefined);
    expect(() => ref.current!.seek(-10)).not.toThrow();
    expect(video.currentTime).toBe(0);
  });
});

describe("VideoPlayer — 控件交互", () => {
  it("倍速菜单：点开 → 5 个选项 → 选 1.5× 修改 video.playbackRate", () => {
    const { container } = render(
      <VideoPlayer src="x" isOpen={true} onOpen={() => {}} durationMs={60_000} />,
    );
    const video = container.querySelector("video") as HTMLVideoElement;
    expect(screen.getByTitle("倍速")).toHaveTextContent("1×");
    fireEvent.click(screen.getByTitle("倍速"));
    expect(screen.getByText("0.75×")).toBeInTheDocument();
    expect(screen.getByText("1.5×")).toBeInTheDocument();
    expect(screen.getByText("2×")).toBeInTheDocument();
    fireEvent.click(screen.getByText("1.5×"));
    expect(video.playbackRate).toBe(1.5);
    expect(screen.getByTitle("倍速")).toHaveTextContent("1.5×");
  });

  it("播放按钮调 video.play()", () => {
    const { container } = render(
      <VideoPlayer src="x" isOpen={true} onOpen={() => {}} durationMs={60_000} />,
    );
    const video = container.querySelector("video") as HTMLVideoElement;
    const playSpy = vi.fn().mockResolvedValue(undefined);
    (video as any).play = playSpy;
    Object.defineProperty(video, "paused", { value: true, configurable: true });
    fireEvent.click(screen.getByTitle("播放"));
    expect(playSpy).toHaveBeenCalled();
  });

  it("onTimeUpdate 把 currentTime 转发出去", () => {
    const onTimeUpdate = vi.fn();
    const { container } = render(
      <VideoPlayer src="x" isOpen={true} onOpen={() => {}} onTimeUpdate={onTimeUpdate} />,
    );
    const video = container.querySelector("video") as HTMLVideoElement;
    Object.defineProperty(video, "currentTime", { value: 12.34, configurable: true });
    fireEvent.timeUpdate(video);
    expect(onTimeUpdate).toHaveBeenCalledWith(12.34);
  });

  it("video onError → 切到错误占位 + 触发 onError 回调", () => {
    const onError = vi.fn();
    const { container } = render(
      <VideoPlayer src="bad-url" isOpen={true} onOpen={() => {}} onError={onError} />,
    );
    const video = container.querySelector("video") as HTMLVideoElement;
    fireEvent.error(video);
    expect(onError).toHaveBeenCalledOnce();
    expect(screen.getByText("视频文件无法加载")).toBeInTheDocument();
  });
});

describe("VideoPlayer — Q/A markers", () => {
  it("传入 markers + durationMs → 渲染 marker 按钮", () => {
    const markers = [
      { offsetMs: 0, role: "agent" as const },
      { offsetMs: 30_000, role: "user" as const },
      { offsetMs: 60_000, role: "agent" as const },
    ];
    render(
      <VideoPlayer
        src="x"
        isOpen={true}
        onOpen={() => {}}
        durationMs={120_000}
        markers={markers}
      />,
    );
    // 每个 marker 是一个带 title 的 button
    expect(screen.getByTitle(/提问 @ 0:00/)).toBeInTheDocument();
    expect(screen.getByTitle(/回答 @ 0:30/)).toBeInTheDocument();
    expect(screen.getByTitle(/提问 @ 1:00/)).toBeInTheDocument();
  });

  it("点击 marker 触发 onMarkerClick(index)", () => {
    const onMarkerClick = vi.fn();
    const markers = [
      { offsetMs: 0, role: "agent" as const },
      { offsetMs: 30_000, role: "user" as const },
    ];
    render(
      <VideoPlayer
        src="x"
        isOpen={true}
        onOpen={() => {}}
        durationMs={60_000}
        markers={markers}
        onMarkerClick={onMarkerClick}
      />,
    );
    fireEvent.click(screen.getByTitle(/回答 @ 0:30/));
    expect(onMarkerClick).toHaveBeenCalledWith(1);
  });

  it("durationMs=0（DB 没值且浏览器没拿到）→ markers 不渲染（避免除零）", () => {
    const markers = [{ offsetMs: 5000, role: "agent" as const }];
    render(
      <VideoPlayer src="x" isOpen={true} onOpen={() => {}} markers={markers} />,
    );
    expect(screen.queryByTitle(/提问/)).toBeNull();
  });
});
