"use client";

import { FeedbackForm } from "@/components/call/feedbackForm";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useResponses } from "@/contexts/responses.context";
import { useI18n } from "@/i18n";
import { reportClientError } from "@/lib/client-error-reporter";
import { getDeviceClass } from "@/lib/device-detect";
import { buildAgentCtrlMessage, parseSubtitleMessage } from "@/lib/volcengine-rtc";
import {
  TIME_UP_GRACE_MS,
  TIME_UP_PROMPT,
  TIME_UP_WARNING_LEAD_SECS,
  computeEndDelayMs,
  detectClosingPhrase,
  parseInterviewDurationMinutes,
  shouldEndOnSilence,
  shouldForceEnd,
  shouldSendTimeUpWarning,
} from "@/lib/interview-timing";
import { appendTurn, type TranscriptEntry as PersistedTurn } from "@/lib/transcript";
import { isLightColor, testEmail } from "@/lib/utils";
import { submitFeedback } from "@/services/feedback.service";
import { getInterviewer } from "@/services/interviewers.service";
import { getAllEmails, saveResponse } from "@/services/responses.service";
import type { Interview } from "@/types/interview";
import type { FeedbackData } from "@/types/response";
import VERTC, { MediaType, RoomProfileType, StreamIndex } from "@volcengine/rtc";
import axios from "axios";
import { AlarmClockIcon, CheckCircleIcon, XCircleIcon } from "lucide-react";
import Image from "next/image";
import React, { useState, useEffect, useRef, useCallback } from "react";
import { toast } from "sonner";
import MiniLoader from "../loaders/mini-loader/miniLoader";
import { Button } from "../ui/button";
import { Card, CardHeader, CardTitle } from "../ui/card";
import { TabSwitchWarning, useTabSwitchPrevention } from "./tabSwitchPrevention";
import LanguageSwitcher from "../languageSwitcher";

type InterviewProps = {
  interview: Interview;
};

type RegisterCallResponse = {
  data: {
    registerCallResponse: {
      call_id: string;
      room_id: string;
      task_id: string;
      user_id: string;
      agent_user_id: string;
      app_id: string;
      token: string;
    };
  };
};

// 别名复用 src/lib/transcript 里抽出来的可测类型
type TranscriptEntry = PersistedTurn;

function Call({ interview }: InterviewProps) {
  const { createResponse } = useResponses();
  const { t } = useI18n();

  // Call state
  const [isCalling, setIsCalling] = useState(false);
  const [isStarted, setIsStarted] = useState(false);
  const [isEnded, setIsEnded] = useState(false);
  const [Loading, setLoading] = useState(false);

  // User inputs
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [isValidEmail, setIsValidEmail] = useState(false);
  const [isOldUser, setIsOldUser] = useState(false);
  const [isInterviewFull, setIsInterviewFull] = useState(false);

  // RTC session info
  const [callId, setCallId] = useState("");
  const [roomId, setRoomId] = useState("");
  const [taskId, setTaskId] = useState("");
  const [agentUserId, setAgentUserId] = useState("");

  // Transcript display
  const [lastInterviewerResponse, setLastInterviewerResponse] = useState("");
  const [lastUserResponse, setLastUserResponse] = useState("");
  const [activeTurn, setActiveTurn] = useState("");

  // Full transcript for analytics
  const transcriptRef = useRef<TranscriptEntry[]>([]);
  const startTimeRef = useRef<number>(0);
  // 录像开始时间（MediaRecorder.start() 之刻）。Q/A 时间戳相对它算，
  // 回放时 video.currentTime = entry.offsetMs / 1000 直接跳到对应位置。
  // 没开录像时退化为 startTimeRef，offsetMs 仍然有用（可显示但没视频可跳）。
  const videoStartTimeRef = useRef<number>(0);

  // Accumulate agent sentences within one turn
  const agentAccumulatedRef = useRef("");
  const wasAgentTurnRef = useRef(false);

  // Timer：currentTimeDuration 只用作 UI 进度条，用墙钟（Date.now - startTimeRef）算，
  // 不再用 setState(t => t+1) 这种漂移严重的 tick 计数器（render 时间累加会让真实 15 分钟跑成 21+ 分钟）
  const [currentTimeDuration, setCurrentTimeDuration] = useState("0");
  const [interviewTimeDuration, setInterviewTimeDuration] = useState("1");

  // 面试时间进度上方的"小提示"气泡：在 0% / 25% / 50% / 95% 各推一条
  // 一旦显示过的索引会被记进 tipShownRef，整场面试不再触发第二次
  const TIP_THRESHOLDS = [0, 25, 50, 95] as const;
  const [activeTipIdx, setActiveTipIdx] = useState<number | null>(null);
  const [tipPhase, setTipPhase] = useState<"in" | "out">("in");
  const tipShownRef = useRef<Set<number>>(new Set());
  const tipDismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tipUnmountTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // UI state
  const [interviewerImg, setInterviewerImg] = useState("");
  const [isFeedbackSubmitted, setIsFeedbackSubmitted] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const { tabSwitchCount } = useTabSwitchPrevention();
  const lastUserResponseRef = useRef<HTMLDivElement | null>(null);
  // mobile/desktop 各有一份字幕 div,通过 callback ref 自动选当前可见的那个绑定:
  // offsetParent === null 表示 display:none(被 viewport 切隐藏),跳过
  const setUserResponseRef = useCallback((el: HTMLDivElement | null) => {
    if (el && el.offsetParent !== null) {
      lastUserResponseRef.current = el;
    }
  }, []);
  // mobile/desktop 各有一个 <video>。两个都挂同一 ref 会 race condition（后挂的覆盖
  // 前挂的，hidden 那个反而拿 ref），导致可见 video 没 srcObject → 黑屏。
  // 解法：两个独立 ref，useEffect 给两个都 attach stream，hidden 那个 setSrc 是 no-op
  const videoRefMobile = useRef<HTMLVideoElement | null>(null);
  const videoRefDesktop = useRef<HTMLVideoElement | null>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);

  // 视频录制：MediaRecorder + VP9 + 0.2 Mbps + 5s 切片
  // 现在采用"边录边传"：每个切片直接 append 到同一 OSS 对象，结束时秒收尾。
  // append 失败 / 不支持的情况下，降级回原"结束时一次性 PUT"路径。
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);

  // WebAudio 混音台：候选人 mic + AI 远端音频 → 单条 mixed audio track 给 MediaRecorder
  // - latencyHint:"interactive" 取最低延迟（典型 ~10ms），把音视频不同步压到察觉不到的范围
  // - mic 在 getUserMedia 后立即接入；AI track 要等 onUserPublishStream 触发后 hot-attach
  // - destination 输出的 audio track 始终存在，混入源动态变化，MediaRecorder 不需要重启
  const audioCtxRef = useRef<AudioContext | null>(null);
  const audioDestRef = useRef<MediaStreamAudioDestinationNode | null>(null);
  const aiAudioAttachedRef = useRef<boolean>(false);
  // 流式上传状态
  const streamObjectKeyRef = useRef<string | null>(null); // 首片返回后保存
  const streamPositionRef = useRef<number>(0);            // 下一个 chunk 的 OSS append position
  const streamPublicUrlRef = useRef<string | null>(null); // 服务端拼好的最终播放 URL
  const streamFailedRef = useRef<boolean>(false);         // 一旦 append 失败 → 降级
  const uploadChainRef = useRef<Promise<void>>(Promise.resolve()); // 串行队列

  // 录像/上传链路诊断：每个 session 各类事件只上报一次，避免刷爆 error_log
  const recDebugReportedRef = useRef({
    probe: false,        // mimeType 探测结果（成功/失败都打）
    appendFailed: false, // 第一次 append 失败
    recorderError: false, // 第一次 MediaRecorder.onerror
  });

  // Attach camera stream to <video> element once it is mounted.
  // The <video> is only rendered when isStarted becomes true, so we need
  // this effect to bind the stream after the element exists.
  useEffect(() => {
    if (!isStarted || !cameraStream) return;
    // 给 mobile + desktop 两个 <video> 都 attach stream
    // hidden 那个 setSrc 没视觉效果但无副作用
    if (videoRefMobile.current) videoRefMobile.current.srcObject = cameraStream;
    if (videoRefDesktop.current) videoRefDesktop.current.srcObject = cameraStream;
  }, [isStarted, cameraStream]);

  // Safety net: release RTC engine + camera on unmount so that if the
  // component ever unmounts mid-call, audio does not keep playing and
  // the room is left cleanly.
  useEffect(() => {
    return () => {
      // 卸载时如果还在录就直接 stop（不等 onstop，因为页面要走了）
      try {
        const rec = mediaRecorderRef.current;
        if (rec && rec.state !== "inactive") rec.stop();
      } catch { /* ignore */ }
      mediaRecorderRef.current = null;
      // 关掉 AudioContext，释放节点
      try {
        audioDestRef.current?.disconnect();
        audioDestRef.current = null;
        const ctx = audioCtxRef.current;
        if (ctx && ctx.state !== "closed") ctx.close().catch(() => {});
        audioCtxRef.current = null;
        aiAudioAttachedRef.current = false;
      } catch { /* ignore */ }
      try {
        cameraStreamRef.current?.getTracks().forEach((t) => t.stop());
        cameraStreamRef.current = null;
      } catch { /* ignore */ }
      const engine = engineRef.current;
      if (engine) {
        try { engine.stopAudioCapture(); } catch { /* ignore */ }
        try { engine.leaveRoom(); } catch { /* ignore */ }
        try { engine.removeAllListeners(); } catch { /* ignore */ }
        engineRef.current = null;
      }
    };
  }, []);

  // RTC engine ref (created once per mount)
  const engineRef = useRef<ReturnType<typeof VERTC.createEngine> | null>(null);
  const agentUserIdRef = useRef<string>("");

  // 时间到结束流程：先给 AI 推一条 [TIME_UP] 提示让它说结束语，
  // 再延迟 ~15s 真正断开 RTC，留给 AI 播报致谢的时间。
  // 常量和纯逻辑在 @/lib/interview-timing 中，便于 unit test。
  const timeUpWarningSentRef = useRef(false);
  const endTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 自动收尾：探测到 AI 结束语 / 发了 [TIME_UP] 后，等双方静默 15s 立即结束，
  // 不再傻等 25s 硬兜底。三个 ref 都是常量级开销，无内存累积。
  const lastAgentSubtitleAtRef = useRef<number>(0);
  const lastUserSubtitleAtRef = useRef<number>(0);
  const awaitingFinalSilenceRef = useRef(false);

  // -------------------------------------------------------------------------
  // Scroll latest user response into view
  // -------------------------------------------------------------------------
  // biome-ignore lint/correctness/useExhaustiveDependencies: scroll on text change
  useEffect(() => {
    if (lastUserResponseRef.current) {
      lastUserResponseRef.current.scrollTop = lastUserResponseRef.current.scrollHeight;
    }
  }, [lastUserResponse]);

  // -------------------------------------------------------------------------
  // Timer —— 用墙钟算 elapsed，不要用 setState 自增的 tick 计数器
  // -------------------------------------------------------------------------
  // 之前的实现：setInterval(() => setTime(t=>t+1), 10) + useEffect 依赖 [time]，
  // 每 tick 重跑整个 effect → 实际每 tick ≈ 14ms（render 开销）→ 15min 的面试
  // 实际跑 21+ 分钟。现在改为：单一 setInterval 每 500ms 读一次 Date.now()，
  // useEffect 只依赖 [isCalling, interviewTimeDuration, handleEndCall]。
  //
  // 同时增加一道墙钟硬兜底：哪怕 setTimeout 被浏览器后台节流没按时触发，只要墙钟
  // 真的过了 totalSeconds + HARD_OVERRUN_SECS 也强制结束，绝对不会再 7 分钟超时。
  const HARD_OVERRUN_SECS = 30;
  // 用 ref 持有 handleEndCall，避免 timer effect 把 handleEndCall 放进依赖
  // 触发 effect 重建（每次 roomId/taskId 变都会重建一次，没必要），
  // 同时绕开「使用先于声明」的 TS 检查。
  const handleEndCallRef = useRef<() => void>(() => {});
  // biome-ignore lint/correctness/useExhaustiveDependencies: 通过 handleEndCallRef 解耦
  useEffect(() => {
    if (!isCalling) return;
    const totalSeconds = parseInterviewDurationMinutes(interviewTimeDuration);

    const tick = () => {
      const elapsedMs = Date.now() - startTimeRef.current;
      const seconds = Math.floor(elapsedMs / 1000);
      setCurrentTimeDuration(String(seconds));

      // 距离结束 ~10s：给 AI 推 [TIME_UP]，让它在剩余时间里说结束语
      if (
        shouldSendTimeUpWarning({
          isCalling: true,
          alreadySent: timeUpWarningSentRef.current,
          elapsedSeconds: seconds,
          totalSeconds,
        })
      ) {
        timeUpWarningSentRef.current = true;
        const engine = engineRef.current;
        const targetAgent = agentUserIdRef.current;
        if (engine && targetAgent) {
          try {
            const tlv = buildAgentCtrlMessage("ExternalTextToLLM", TIME_UP_PROMPT, 2);
            (engine as any).sendUserBinaryMessage(targetAgent, tlv.buffer);
            console.log("[Call] TIME_UP sent at", seconds, "s of", totalSeconds, "s");
          } catch (err) {
            console.warn("[Call] failed to send TIME_UP:", err);
          }
        } else {
          console.warn("[Call] TIME_UP skipped — engine or agent not ready", {
            hasEngine: !!engine,
            agent: targetAgent,
          });
        }
        // 打开静默探测；把"上次说话时间"重置为 now 才能给 AI 留时间先说结束语，
        // 否则 lastAgent=0 → silence 立即满足 → 还没说话就结束了
        awaitingFinalSilenceRef.current = true;
        const now = Date.now();
        lastAgentSubtitleAtRef.current = now;
        lastUserSubtitleAtRef.current = now;

        if (endTimeoutRef.current) clearTimeout(endTimeoutRef.current);
        endTimeoutRef.current = setTimeout(() => {
          handleEndCallRef.current();
        }, computeEndDelayMs(TIME_UP_WARNING_LEAD_SECS, TIME_UP_GRACE_MS));
      }

      // 静默探测：探到结束语 / 发了 [TIME_UP] 之后，agent 和 user 双方都 ≥15s 没说话就立即结束。
      // 比 25s 硬兜底更快，正常情况下能省 5-15 秒；任一方还在说话就不会触发，避免打断收尾对话。
      if (
        shouldEndOnSilence({
          awaiting: awaitingFinalSilenceRef.current,
          lastAgentAt: lastAgentSubtitleAtRef.current,
          lastUserAt: lastUserSubtitleAtRef.current,
        })
      ) {
        console.log(
          "[Call] final silence detected, ending early. agent_silent=",
          Date.now() - lastAgentSubtitleAtRef.current,
          "user_silent=",
          Date.now() - lastUserSubtitleAtRef.current,
        );
        awaitingFinalSilenceRef.current = false;
        handleEndCallRef.current();
        return;
      }

      // 兜底 1：总时长太短（< 前置量），跳过警告直接到点结束
      if (
        shouldForceEnd({
          isCalling: true,
          endScheduled: !!endTimeoutRef.current,
          elapsedSeconds: seconds,
          totalSeconds,
        })
      ) {
        handleEndCallRef.current();
        return;
      }

      // 兜底 2：墙钟硬截止——即使 setTimeout 被节流/丢失也强制结束
      if (totalSeconds > 0 && seconds >= totalSeconds + HARD_OVERRUN_SECS) {
        console.warn("[Call] hard deadline overrun, force ending. elapsed=", seconds, "total=", totalSeconds);
        handleEndCallRef.current();
      }
    };

    tick();
    const intervalId = setInterval(tick, 500);
    return () => clearInterval(intervalId);
  }, [isCalling, interviewTimeDuration]);

  // 组件卸载时清理结束定时器
  useEffect(() => {
    return () => {
      if (endTimeoutRef.current) {
        clearTimeout(endTimeoutRef.current);
        endTimeoutRef.current = null;
      }
    };
  }, []);

  // 进度阈值触发"小提示"气泡：0% / 25% / 50% / 95% 各推一条，每条只触发一次
  // - 显示 8.5s 后切到淡出动画，再过 0.4s 卸载（让 CSS 动画跑完）
  // - 切换到下一条 tip 时立即清掉前一条的 timer 防止状态错乱
  useEffect(() => {
    if (!isCalling) return;
    const total = Number(interviewTimeDuration) * 60;
    if (!Number.isFinite(total) || total <= 0) return;
    const cur = Number(currentTimeDuration);
    const pct = (cur / total) * 100;

    for (let i = 0; i < TIP_THRESHOLDS.length; i++) {
      if (pct >= TIP_THRESHOLDS[i] && !tipShownRef.current.has(i)) {
        tipShownRef.current.add(i);
        if (tipDismissTimerRef.current) clearTimeout(tipDismissTimerRef.current);
        if (tipUnmountTimerRef.current) clearTimeout(tipUnmountTimerRef.current);
        setTipPhase("in");
        setActiveTipIdx(i);
        tipDismissTimerRef.current = setTimeout(() => setTipPhase("out"), 8500);
        tipUnmountTimerRef.current = setTimeout(() => setActiveTipIdx(null), 8900);
        break;
      }
    }
  }, [currentTimeDuration, interviewTimeDuration, isCalling]);

  // 卸载时清掉 tip 的 timer
  useEffect(() => {
    return () => {
      if (tipDismissTimerRef.current) clearTimeout(tipDismissTimerRef.current);
      if (tipUnmountTimerRef.current) clearTimeout(tipUnmountTimerRef.current);
    };
  }, []);

  // -------------------------------------------------------------------------
  // Email validation
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (testEmail(email)) setIsValidEmail(true);
  }, [email]);

  // -------------------------------------------------------------------------
  // Interview duration
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (interview?.time_duration) setInterviewTimeDuration(interview.time_duration);
  }, [interview]);

  // -------------------------------------------------------------------------
  // Fetch + 预加载面试官头像
  // 优化：
  //   1. 优先用 interview.interviewer_image（getInterviewById 已经 LEFT JOIN 取回）
  //      省掉 getInterviewer 的二次 roundtrip
  //   2. 拿到 URL 立刻 new Image() 触发浏览器开始下载，
  //      此时 <img> 元素还没 mount（要等用户点"开始面试"），
  //      候选人填邮箱/姓名的 5-30s 里图片已经躺在缓存，挂载瞬间 0 延迟
  //   3. JOIN 失败时 fallback 到老路径（getInterviewer），保证向后兼容
  // -------------------------------------------------------------------------
  useEffect(() => {
    const joinedImg = interview.interviewer_image;
    if (joinedImg) {
      setInterviewerImg(joinedImg);
      return;
    }
    // fallback：老数据 / JOIN 没拿到 → 异步走原路径
    const fetchInterviewer = async () => {
      const interviewer = await getInterviewer(interview.interviewer_id);
      if (interviewer?.image) {
        setInterviewerImg(interviewer.image);
      }
    };
    fetchInterviewer();
  }, [interview.interviewer_image, interview.interviewer_id]);

  // 拿到头像 URL 后立即预下载（即使 <img> 还没 mount），用户点"开始面试"时秒出图
  useEffect(() => {
    if (!interviewerImg) return;
    const preload = new window.Image();
    preload.src = interviewerImg;
  }, [interviewerImg]);

  // -------------------------------------------------------------------------
  // Save response when call ends
  // -------------------------------------------------------------------------
  // biome-ignore lint/correctness/useExhaustiveDependencies: intentional
  useEffect(() => {
    // console.log("[REPORT] isEnded changed:", isEnded, "callId:", callId || "(empty)");
    if (isEnded && callId) {
      const persist = async () => {
        const endTs = Date.now();
        const entries = transcriptRef.current;
        // console.log("[REPORT] persisting response, transcript entries:", entries.length);
        // console.log("[REPORT] transcript preview:", JSON.stringify(entries.slice(0, 3)));

        const transcriptText = entries
          .map((e) => `${e.role === "agent" ? "Agent" : "User"}: ${e.content}`)
          .join("\n");

        try {
          await saveResponse(
            {
              is_ended: true,
              tab_switch_count: tabSwitchCount,
              details: {
                transcript: transcriptText,
                transcript_object: entries.map((e) => ({
                  role: e.role,
                  content: e.content,
                  offsetMs: e.offsetMs, // 必须带上，否则详情页 Q/A 时间戳全是 0:00、点击跳转都跳到开头
                })),
                start_timestamp: startTimeRef.current,
                end_timestamp: endTs,
              },
            },
            callId,
          );
          // console.log("[REPORT] saveResponse succeeded for callId:", callId);
        } catch (err) {
          // console.error("[REPORT] saveResponse FAILED:", err);
          void err;
        }
      };
      persist();
    } else if (isEnded && !callId) {
      // console.warn("[REPORT] isEnded=true but callId is empty — saveResponse skipped!");
    }
  }, [isEnded]);

  // -------------------------------------------------------------------------
  // Feedback
  // -------------------------------------------------------------------------
  const handleFeedbackSubmit = async (formData: Omit<FeedbackData, "interview_id">) => {
    try {
      const result = await submitFeedback({
        ...formData,
        interview_id: interview.id,
      });
      if (result) {
        toast.success(t("feedback.thankYou"));
        setIsFeedbackSubmitted(true);
        setIsDialogOpen(false);
      } else {
        toast.error(t("feedback.failed"));
      }
    } catch (error) {
      console.error("Error submitting feedback:", error);
      toast.error(t("feedback.errorOccurred"));
    }
  };

  // -------------------------------------------------------------------------
  // 把录制的视频 Blob 直传 OSS，并把 publicUrl + 真实时长写到 response。
  // fire-and-forget：失败时只 log，不影响其它数据完整性（音频+文本依然完整）。
  // -------------------------------------------------------------------------
  const uploadVideoToOSS = useCallback(async (
    blob: Blob,
    callIdForUpload: string,
    videoDurationMs: number,
  ) => {
    try {
      // 1. 拿预签名 PUT URL
      const signRes = await axios.post("/api/oss/upload-call-video", {
        call_id: callIdForUpload,
        content_type: blob.type || "video/webm",
      });
      const { uploadUrl, publicUrl } = signRes.data as {
        uploadUrl: string;
        publicUrl: string;
      };
      if (!uploadUrl || !publicUrl) {
        console.warn("[CAM] no uploadUrl from sign API:", signRes.data);
        return;
      }

      // 2. 浏览器直传 OSS（不绕 Next.js）
      //    Content-Type 必须和签名时一致，否则 OSS 拒绝
      const putRes = await fetch(uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": blob.type || "video/webm" },
        body: blob,
      });
      if (!putRes.ok) {
        const text = await putRes.text().catch(() => "");
        console.error("[CAM] OSS PUT failed", putRes.status, text);
        return;
      }

      // 3. 写到 response.video_url + 真实时长
      await saveResponse(
        { video_url: publicUrl, video_duration_ms: videoDurationMs },
        callIdForUpload,
      );
      console.log(
        "[CAM] video uploaded:",
        publicUrl,
        "size=",
        blob.size,
        "duration_ms=",
        videoDurationMs,
      );
    } catch (err) {
      console.error("[CAM] uploadVideoToOSS failed:", err);
    }
  }, []);

  // -------------------------------------------------------------------------
  // End call (shared logic)
  // -------------------------------------------------------------------------
  const handleEndCall = useCallback(async () => {
    // 取消可能挂起的"时间到延迟结束"定时器，防止重复执行
    if (endTimeoutRef.current) {
      clearTimeout(endTimeoutRef.current);
      endTimeoutRef.current = null;
    }

    // 1. 先停 MediaRecorder（必须在 camera tracks 停止前），等最后一片 chunk flush
    //    流式 append 模式：等所有 chunk append 完，拿 streamPublicUrlRef 直接保存
    //    流式失败模式：拿全部 chunks 拼成 Blob，走降级 uploadVideoToOSS
    const recorder = mediaRecorderRef.current;
    let videoBlob: Blob | null = null;
    if (recorder && recorder.state !== "inactive") {
      try {
        await new Promise<void>((resolve) => {
          recorder.onstop = () => resolve();
          setTimeout(resolve, 5000); // 5s 兜底防 onstop 不 fire
          recorder.stop();
        });
        // 等串行 append 队列消化完（如果还在跑），再 5s 兜底
        await Promise.race([
          uploadChainRef.current.catch(() => {}),
          new Promise((r) => setTimeout(r, 5000)),
        ]);
        // 流式失败 → 拼 Blob 走降级；流式成功 → 不需要 blob
        if (streamFailedRef.current && recordedChunksRef.current.length > 0) {
          const mimeType = recorder.mimeType || "video/webm";
          videoBlob = new Blob(recordedChunksRef.current, { type: mimeType });
        }
      } catch (err) {
        console.warn("[CAM] recorder stop failed:", err);
      }
    }
    mediaRecorderRef.current = null;

    // 录像生命周期 summary：在停掉 recorder、append 队列消化完之后打一条总结，
    // 这是一次面试录像情况的"最终判决书"。iOS 微信调试时这条最有用。
    // 仅当真的尝试过录像（有 chunk 或失败标记）时才上报，避免 video_disabled 场景刷量。
    if (recordedChunksRef.current.length > 0 || streamFailedRef.current) {
      const totalBytes = recordedChunksRef.current.reduce((sum, b) => sum + b.size, 0);
      reportClientError({
        kind: "manual",
        level: "info",
        message: `[CAM-DEBUG] recording end: chunks=${recordedChunksRef.current.length} bytes=${totalBytes} streamFailed=${streamFailedRef.current}`,
        extra: {
          chunkCount: recordedChunksRef.current.length,
          totalBytes,
          streamFailed: streamFailedRef.current,
          streamUploadedBytes: streamPositionRef.current,
          publicUrl: streamPublicUrlRef.current,
          willFallbackPut: streamFailedRef.current && recordedChunksRef.current.length > 0,
          callId,
        },
      });
    }

    // 关掉 AudioContext，释放 mic/AI 节点（防止泄漏；unmount 兜底里也会再做一遍）
    try {
      audioDestRef.current?.disconnect();
      audioDestRef.current = null;
      const ctx = audioCtxRef.current;
      if (ctx && ctx.state !== "closed") {
        ctx.close().catch(() => {});
      }
      audioCtxRef.current = null;
      aiAudioAttachedRef.current = false;
    } catch { /* ignore */ }

    try {
      // 2. 停 camera tracks（必须在 recorder.stop() 之后）
      if (cameraStreamRef.current) {
        cameraStreamRef.current.getTracks().forEach((track) => track.stop());
        cameraStreamRef.current = null;
      }
      setCameraStream(null);
      const engine = engineRef.current;
      if (engine) {
        try {
          await engine.stopAudioCapture();
        } catch { /* ignore if already stopped */ }
        try {
          await engine.unpublishStream(MediaType.AUDIO);
        } catch { /* ignore "not connected" */ }
        try {
          await engine.leaveRoom();
        } catch { /* ignore if already left */ }
        engine.removeAllListeners();
        engineRef.current = null;
      }
      if (roomId && taskId) {
        await axios.post("/api/stop-call", { room_id: roomId, task_id: taskId });
      }
    } catch (err) {
      console.error("Error ending call:", err);
    } finally {
      setIsCalling(false);
      setIsEnded(true);
      setLoading(false);
    }

    // 3. 收尾视频 URL + 真实时长：
    //    - 流式成功：append 已经把全部数据送上 OSS，publicUrl 现成的，直接写 DB
    //    - 流式失败 + 还有 blob：走原来的一次性 PUT 兜底
    //    无论哪种路径，都把 wall-clock 算的真实时长存到 video_duration_ms，
    //    详情页播放器渲染进度条用这个值（浏览器自报 video.duration 不可靠）
    if (callId) {
      const videoDurationMs =
        videoStartTimeRef.current > 0
          ? Math.max(0, Date.now() - videoStartTimeRef.current)
          : 0;

      if (!streamFailedRef.current && streamPublicUrlRef.current) {
        const urlToSave = streamPublicUrlRef.current;
        saveResponse(
          { video_url: urlToSave, video_duration_ms: videoDurationMs },
          callId,
        )
          .then(() =>
            console.log(
              "[CAM] streaming video saved:",
              urlToSave,
              "duration_ms=",
              videoDurationMs,
            ),
          )
          .catch((err) => console.error("[CAM] saveResponse video_url failed:", err));
      } else if (videoBlob) {
        void uploadVideoToOSS(videoBlob, callId, videoDurationMs);
      }
    }
  }, [roomId, taskId, callId, uploadVideoToOSS]);

  // 让 timer effect 通过 ref 拿到永远最新的 handleEndCall
  useEffect(() => {
    handleEndCallRef.current = handleEndCall;
  }, [handleEndCall]);

  const onEndCallClick = async () => {
    if (isStarted) {
      setLoading(true);
      await handleEndCall();
    } else {
      setIsEnded(true);
    }
  };

  // -------------------------------------------------------------------------
  // Start conversation
  // -------------------------------------------------------------------------
  const startConversation = async () => {
    setLoading(true);
    timeUpWarningSentRef.current = false;
    if (endTimeoutRef.current) {
      clearTimeout(endTimeoutRef.current);
      endTimeoutRef.current = null;
    }
    try {
      const oldUserEmails: string[] = (await getAllEmails(interview.id)).map((item) => item.email);

      // Limit: same interview cannot be taken more than 10 times
      if (oldUserEmails.length >= 10) {
        setIsInterviewFull(true);
        setLoading(false);
        return;
      }

      const isOld =
        oldUserEmails.includes(email) ||
        (interview?.respondents && !interview?.respondents.includes(email));

      if (isOld) {
        setIsOldUser(true);
        setLoading(false);
        return;
      }

      const data = {
        mins: interview?.time_duration,
        objective: interview?.objective,
        // 带编号 + 换行：让 LLM 能数清楚一共几题、问到第几题，避免循环重问。
        // 配合 buildInterviewerPrompt 里的"共 N 题，问完第 N 题立即结束"硬规则一起生效。
        questions: interview?.questions
          .map((q, i) => `${i + 1}. ${q.question}`)
          .join("\n"),
        questionCount: interview?.questions.length ?? 0,
        name: name || "not provided",
        language: interview?.language ?? "zh",
      };

      const registerRes: RegisterCallResponse = await axios.post("/api/register-call", {
        dynamic_data: data,
        interviewer_id: interview?.interviewer_id,
        organization_id: interview?.organization_id,
      });

      const {
        call_id,
        room_id,
        task_id,
        user_id,
        agent_user_id,
        app_id,
        token,
      } = registerRes.data.registerCallResponse;

      setCallId(call_id);
      setRoomId(room_id);
      setTaskId(task_id);
      setAgentUserId(agent_user_id);
      agentUserIdRef.current = agent_user_id;

      // Create response record in DB
      await createResponse({
        interview_id: interview.id,
        call_id,
        email,
        name,
      });

      // -----------------------------------------------------------------------
      // Start camera first (local preview only) so the video element has a
      // stream ready as soon as it mounts.
      // -----------------------------------------------------------------------
      // 摄像头永远开启（不管 is_video_enabled 是 true 还是 false）：
      // 候选人需要看到自己的画面，体验上必须有；
      // is_video_enabled 只控制是否启动 MediaRecorder 录制 + 上传 OSS。
      const recordingEnabled = interview?.is_video_enabled !== false;
      // mobile 设备整体降低视频负担:分辨率/帧率/码率全部减半,
      // 把 CPU 让给 RTC 音频解码线程,改善 AI 声音流畅度(D 优化)
      const isMobileDevice = getDeviceClass().isMobile;
      try {
        // audio:true 让 MediaRecorder 同时录用户麦克风（如开启录像）；
        //   即使不录，AudioContext 拿到 mic 流也能给将来的混音/分析留口子。
        // 显式开 echoCancellation+noiseSuppression：候选人外放时 AEC 把扬声器漏到 mic 的
        //   AI 声音消掉，避免录像里 AI 声音听两遍 + 防止 ASR 把 AI 自己的话识别成用户输入。
        // Volcengine RTC 会自己再 getUserMedia 拿一份做 ASR，Chrome 允许同一 mic 被
        //   多个 stream 同时读取，实测无冲突。
        // 视频参数：desktop 192×256@12fps@80kbps,mobile 128×172@6fps(等比缩小,减半负担)
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: "user",
            width: { ideal: isMobileDevice ? 128 : 192 },
            height: { ideal: isMobileDevice ? 172 : 256 },
            frameRate: {
              ideal: isMobileDevice ? 6 : 12,
              max: isMobileDevice ? 8 : 12,
            },
          },
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });
        cameraStreamRef.current = stream;
        setCameraStream(stream);

        // 建 WebAudio 混音台。AI track 要等到 onUserPublishStream 才能拿到，
        // 所以先建 destination，把候选人 mic 接进去，destination 的输出 track 立刻可用；
        // AI track 后续 hot-attach 进同一个 destination，MediaRecorder 无感知。
        // latencyHint:"interactive" 走最低延迟路径，把额外的处理延迟压到 ~10ms。
        let mixedAudioTrack: MediaStreamTrack | null = null;
        try {
          const AudioCtx =
            (window as any).AudioContext || (window as any).webkitAudioContext;
          if (AudioCtx) {
            const ctx = new AudioCtx({ latencyHint: "interactive" }) as AudioContext;
            audioCtxRef.current = ctx;
            const dest = ctx.createMediaStreamDestination();
            audioDestRef.current = dest;
            // 候选人 mic 立刻接入
            const micTracks = stream.getAudioTracks();
            if (micTracks.length > 0) {
              const micSource = ctx.createMediaStreamSource(
                new MediaStream([micTracks[0]]),
              );
              micSource.connect(dest);
            }
            mixedAudioTrack = dest.stream.getAudioTracks()[0] ?? null;
          }
        } catch (mixErr) {
          console.warn("[CAM] AudioContext init failed, fall back to mic-only:", mixErr);
        }

        // 启动 MediaRecorder 录制 — 仅在 is_video_enabled=true 时执行
        // 即使关闭录像，前面的 getUserMedia 也已经跑过，候选人能看到自己画面
        if (recordingEnabled) try {
          let mimeType = "";
          // 探测每个候选 mimeType 的支持情况，全部记下来发到 error_log
          // 这样 iOS 微信复现时直接能看到："webm 全 false、mp4 全 false" → 根因是 MediaRecorder 不支持
          const probeResult: Record<string, boolean> = {};
          if (typeof MediaRecorder !== "undefined") {
            // mobile: H264 通常有硬件加速,优先;VP9 fallback
            // desktop: VP9 软编 CPU 占用可控,优先(更小文件)
            // (B 优化: mobile 用 H264 减少编码 CPU,给 RTC 音频解码线程腾出资源)
            const candidates = isMobileDevice
              ? [
                  "video/mp4;codecs=h264,aac",
                  "video/mp4",
                  "video/webm;codecs=vp8,opus",
                  "video/webm;codecs=vp9,opus",
                  "video/webm",
                ]
              : [
                  "video/webm;codecs=vp9,opus",
                  "video/webm;codecs=vp8,opus",
                  "video/webm",
                  "video/mp4;codecs=h264,aac",
                  "video/mp4",
                ];
            for (const candidate of candidates) {
              const supported = MediaRecorder.isTypeSupported(candidate);
              probeResult[candidate] = supported;
              if (supported && !mimeType) mimeType = candidate;
            }
          }
          if (!recDebugReportedRef.current.probe) {
            recDebugReportedRef.current.probe = true;
            const dev = getDeviceClass();
            reportClientError({
              kind: "manual",
              level: "info",
              message: `[CAM-DEBUG] mimeType probe: ${mimeType || "NONE"}`,
              extra: {
                pickedMime: mimeType,
                hasMediaRecorder: typeof MediaRecorder !== "undefined",
                probeResult,
                device: dev,
                screen: typeof window !== "undefined"
                  ? { w: window.innerWidth, h: window.innerHeight, dpr: window.devicePixelRatio }
                  : null,
                callId: call_id,
              },
            });
          }
          if (mimeType) {
            // 喂给 MediaRecorder 的 stream：摄像头 video + 混音 audio
            // 混音 track 建不出来时退回原 mic 音轨，至少录到候选人声音
            const videoTrack = stream.getVideoTracks()[0];
            const recorderStream = new MediaStream();
            if (videoTrack) recorderStream.addTrack(videoTrack);
            if (mixedAudioTrack) {
              recorderStream.addTrack(mixedAudioTrack);
            } else {
              const micFallback = stream.getAudioTracks()[0];
              if (micFallback) recorderStream.addTrack(micFallback);
            }
            const recorder = new MediaRecorder(recorderStream, {
              mimeType,
              // desktop 80kbps / mobile 40kbps —— mobile 减半减少编码 CPU 抢占
              // 配合 mobile 6fps + 128×172,实际负载 ~30% 桌面水平
              videoBitsPerSecond: isMobileDevice ? 40_000 : 80_000,
              audioBitsPerSecond: 32_000, // 32kbps opus,人声足够
            });
            // recorder 自身错误（编码失败 / track 异常 / WebView 限制）
            // 这是 iOS 微信视频上传调试的关键信号 —— 探测过了但实际跑不起来时这里会触发
            recorder.onerror = (e) => {
              console.warn("[CAM] MediaRecorder.onerror:", e);
              if (!recDebugReportedRef.current.recorderError) {
                recDebugReportedRef.current.recorderError = true;
                const errAny = e as unknown as { error?: { name?: string; message?: string } };
                reportClientError({
                  kind: "manual",
                  level: "warn",
                  message: "[CAM-DEBUG] MediaRecorder.onerror fired",
                  extra: {
                    errorName: errAny.error?.name ?? null,
                    errorMessage: errAny.error?.message ?? null,
                    recorderState: recorder.state,
                    mimeType: recorder.mimeType,
                    callId: call_id,
                  },
                });
              }
            };
            recordedChunksRef.current = [];
            // 重置流式上传状态
            streamObjectKeyRef.current = null;
            streamPositionRef.current = 0;
            streamPublicUrlRef.current = null;
            streamFailedRef.current = false;
            uploadChainRef.current = Promise.resolve();

            const callIdAtStart = call_id; // 闭包捕获，防止 ref 被后续 startConversation 重置

            recorder.ondataavailable = (e) => {
              if (!e.data || e.data.size === 0) return;
              // 每片都进 chunks 队列（兜底用：流式失败时降级一次性 PUT）
              recordedChunksRef.current.push(e.data);
              // 串行 append。失败后停止再尝试，handleEndCall 会判断 streamFailed 走降级
              if (streamFailedRef.current) return;
              const chunk = e.data;
              uploadChainRef.current = uploadChainRef.current.then(async () => {
                if (streamFailedRef.current) return;
                try {
                  const isFirst = streamObjectKeyRef.current === null;
                  const params = new URLSearchParams({
                    call_id: callIdAtStart,
                    position: String(streamPositionRef.current),
                  });
                  if (isFirst) {
                    params.set("first", "1");
                    // 首片必须告诉后端 mime，让 OSS objectKey 带正确扩展名 + 设对 Content-Type
                    // 取 recorder.mimeType（含 codecs 后缀也没事，后端正则容忍）
                    params.set("content_type", recorder.mimeType || "video/webm");
                  } else {
                    params.set("object_key", streamObjectKeyRef.current!);
                  }

                  const buf = await chunk.arrayBuffer();
                  const res = await fetch(
                    `/api/oss/append-call-video?${params.toString()}`,
                    {
                      method: "POST",
                      headers: { "Content-Type": "application/octet-stream" },
                      body: buf,
                    },
                  );
                  if (!res.ok) {
                    const text = await res.text().catch(() => "");
                    console.warn("[CAM] append failed", res.status, text);
                    if (!recDebugReportedRef.current.appendFailed) {
                      recDebugReportedRef.current.appendFailed = true;
                      reportClientError({
                        kind: "manual",
                        level: "warn",
                        message: `[CAM-DEBUG] OSS append failed status=${res.status}`,
                        extra: {
                          status: res.status,
                          responseBody: text.slice(0, 500),
                          isFirst,
                          chunkSize: buf.byteLength,
                          callId: callIdAtStart,
                        },
                      });
                    }
                    streamFailedRef.current = true;
                    return;
                  }
                  const data = (await res.json()) as {
                    nextAppendPosition: number;
                    objectKey: string;
                    publicUrl: string;
                  };
                  streamObjectKeyRef.current = data.objectKey;
                  streamPositionRef.current = Number(data.nextAppendPosition);
                  streamPublicUrlRef.current = data.publicUrl;
                } catch (err) {
                  console.warn("[CAM] append exception:", err);
                  if (!recDebugReportedRef.current.appendFailed) {
                    recDebugReportedRef.current.appendFailed = true;
                    reportClientError({
                      kind: "manual",
                      level: "warn",
                      message: "[CAM-DEBUG] OSS append threw (network/CORS/cert?)",
                      extra: {
                        errorMessage: err instanceof Error ? err.message : String(err),
                        callId: callIdAtStart,
                      },
                    });
                  }
                  streamFailedRef.current = true;
                }
              });
            };

            recorder.start(5000); // 每 5s 切一片 → 触发一次 append
            // 录像 0 时刻 ≈ recorder.start() 调用时间，给 transcript offset 当锚
            videoStartTimeRef.current = Date.now();
            mediaRecorderRef.current = recorder;
            console.log("[CAM] MediaRecorder + streaming append started, mime=", mimeType);
          } else {
            console.warn("[CAM] MediaRecorder not supported, skip video recording");
            // probe 那条已经报过了，这里只在 probe 没成功上报时补一发兜底（理论上不会走到）
            if (!recDebugReportedRef.current.probe) {
              recDebugReportedRef.current.probe = true;
              reportClientError({
                kind: "manual",
                level: "warn",
                message: "[CAM-DEBUG] No supported mimeType — skipping recording",
                extra: { callId: call_id, device: getDeviceClass() },
              });
            }
          }
        } catch (recErr) {
          console.warn("[CAM] MediaRecorder init failed, skip video recording:", recErr);
          reportClientError({
            kind: "manual",
            level: "warn",
            message: "[CAM-DEBUG] MediaRecorder init threw",
            extra: {
              errorMessage: recErr instanceof Error ? recErr.message : String(recErr),
              callId: call_id,
            },
          });
        }
      } catch (camErr) {
        // 摄像头被拒不阻塞面试本身
        void camErr;
      }

      // Transition UI to the in-call view so the <video> element mounts and
      // starts rendering the camera preview.
      setIsStarted(true);

      // Give the page a moment to finish rendering the call UI before we
      // actually join the RTC room. This ensures the video element is
      // mounted and the user sees the interface load cleanly.
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // -----------------------------------------------------------------------
      // Initialize ByteRTC engine
      // -----------------------------------------------------------------------
      // console.log("[RTC] createEngine with appId:", app_id);
      const engine = VERTC.createEngine(app_id);
      engineRef.current = engine;

      // Subscribe to audio streams from other participants (the AI agent)
      engine.on(VERTC.events.onUserPublishStream, async ({ userId, mediaType }) => {
        // console.log("[RTC] onUserPublishStream:", userId, mediaType);
        if (mediaType === MediaType.AUDIO) {
          await engine.subscribeStream(userId, MediaType.AUDIO);
          setActiveTurn("agent");

          // Hot-attach AI 远端音频到混音 destination —— 录像里就有 AI 声音了。
          // 只在第一次 attach（aiAudioAttachedRef 防重复连接），并仅 attach 真正的 agent。
          if (
            !aiAudioAttachedRef.current &&
            userId === agentUserIdRef.current &&
            audioCtxRef.current &&
            audioDestRef.current
          ) {
            try {
              const aiTrack = (engine as any).getRemoteStreamTrack?.(
                userId,
                StreamIndex.STREAM_INDEX_MAIN,
                "audio",
              ) as MediaStreamTrack | undefined;
              if (aiTrack) {
                const aiSource = audioCtxRef.current.createMediaStreamSource(
                  new MediaStream([aiTrack]),
                );
                aiSource.connect(audioDestRef.current);
                aiAudioAttachedRef.current = true;
                console.log("[CAM] AI audio attached to recording mix");
              } else {
                console.warn("[CAM] getRemoteStreamTrack returned undefined for AI");
              }
            } catch (mixErr) {
              console.warn("[CAM] attach AI audio to mix failed:", mixErr);
            }
          }
        }
      });

      engine.on(VERTC.events.onUserUnpublishStream, ({ userId }) => {
        // console.log("[RTC] onUserUnpublishStream:", userId);
        if (userId === agentUserIdRef.current) {
          setActiveTurn("user");
        }
      });

      // Receive subtitle / transcript binary messages
      engine.on(VERTC.events.onRoomBinaryMessageReceived, (event: any) => {
        // console.log("[RTC] onRoomBinaryMessageReceived fired, event keys:", Object.keys(event));
        const message = event.message ?? event.binaryMessage ?? event;
        const userId = event.userId ?? event.uid ?? "";
        // console.log("[RTC] binary message from:", userId, "size:", message?.byteLength ?? "N/A");
        const parsed = parseSubtitleMessage(message, userId as string, agentUserIdRef.current);
        if (!parsed) return;

        if (parsed.role === "agent") {
          // Reset accumulation at the start of a new agent turn
          if (!wasAgentTurnRef.current) {
            agentAccumulatedRef.current = "";
            wasAgentTurnRef.current = true;
          }
          setActiveTurn("agent");
          // 静默探测：partial 也算"在说话"，立即刷新时间戳
          lastAgentSubtitleAtRef.current = Date.now();
          if (parsed.isFinal) {
            agentAccumulatedRef.current +=
              (agentAccumulatedRef.current ? " " : "") + parsed.text;
            setLastInterviewerResponse(agentAccumulatedRef.current);
            // Turn 聚合：同一 role 连续多句 → 拼到上一个 entry，不新增
            // 这样"AI 一段话被字幕拆成多句"只会保留最早那句的 offsetMs（满足用户要求）
            appendTurn(
              transcriptRef.current,
              "agent",
              parsed.text,
              Date.now(),
              videoStartTimeRef.current || startTimeRef.current || Date.now(),
            );
            // 探到结束语关键词 → 打开静默判定开关，等双方静默 15s 自动结束
            if (
              !awaitingFinalSilenceRef.current &&
              detectClosingPhrase(parsed.text)
            ) {
              awaitingFinalSilenceRef.current = true;
              console.log("[Call] closing phrase detected:", parsed.text);
            }
          } else {
            // Show accumulated + in-progress partial text
            setLastInterviewerResponse(
              agentAccumulatedRef.current +
                (agentAccumulatedRef.current ? " " : "") +
                parsed.text
            );
          }
        } else {
          wasAgentTurnRef.current = false;
          setActiveTurn("user");
          setLastUserResponse(parsed.text);
          // 静默探测：用户说话也算活跃（含 partial），刷新时间戳避免误结束
          lastUserSubtitleAtRef.current = Date.now();
          if (parsed.isFinal) {
            // 同样按 turn 聚合
            appendTurn(
              transcriptRef.current,
              "user",
              parsed.text,
              Date.now(),
              videoStartTimeRef.current || startTimeRef.current || Date.now(),
            );
          }
        }
      });

      // Debug: monitor local mic volume (to verify user audio is captured)
      let localVolLogCount = 0;
      engine.on(VERTC.events.onLocalAudioPropertiesReport as any, (event: any) => {
        // Throttle: print every ~20th (assume 2Hz reports => ~10s interval)
        if (localVolLogCount++ % 20 === 0) {
          const data = Array.isArray(event) ? event[0] : event;
          const level = data?.audioPropertiesInfo?.linearVolume
            ?? data?.audioPropertiesInfo?.nonlinearVolume
            ?? data?.linearVolume;
          // console.log("[RTC][MIC] local volume:", level, "raw:", JSON.stringify(event).substring(0, 200));
          void level;
        }
      });

      // Debug: monitor remote audio activity (to confirm agent audio arriving)
      let remoteVolLogCount = 0;
      engine.on(VERTC.events.onRemoteAudioPropertiesReport, (event: any) => {
        if (remoteVolLogCount++ % 20 === 0) {
          // console.log("[RTC][SPK] remote volume report:", JSON.stringify(event).substring(0, 200));
        }
      });

      // Local audio state (capture / device change)
      engine.on((VERTC.events as any).onLocalAudioStateChanged, (event: any) => {
        // console.log("[RTC][MIC] onLocalAudioStateChanged:", JSON.stringify(event));
      });

      // User start/stop audio capture
      engine.on(VERTC.events.onUserStartAudioCapture as any, (event: any) => {
        // console.log("[RTC][MIC] onUserStartAudioCapture:", JSON.stringify(event));
      });
      engine.on(VERTC.events.onUserStopAudioCapture as any, (event: any) => {
        // console.log("[RTC][MIC] onUserStopAudioCapture:", JSON.stringify(event));
      });

      // Audio device warning (mic blocked, no permission, etc.)
      engine.on(VERTC.events.onAudioDeviceStateChanged as any, (event: any) => {
        // console.log("[RTC][DEV] onAudioDeviceStateChanged:", JSON.stringify(event));
      });

      // Debug: user message (non-binary)
      engine.on(VERTC.events.onUserMessageReceived, (event: any) => {
        // console.log("[RTC] onUserMessageReceived:", JSON.stringify(event).substring(0, 300));
      });

      // Debug: room message (non-binary)
      engine.on(VERTC.events.onRoomMessageReceived, (event: any) => {
        // console.log("[RTC] onRoomMessageReceived:", JSON.stringify(event).substring(0, 300));
      });

      engine.on(VERTC.events.onError, (error) => {
        // console.error("[RTC] onError event:", JSON.stringify(error));
        void error;
        handleEndCall();
      });

      // 详细诊断日志
      // console.log("[RTC] joinRoom params:", {
      //   token: token.substring(0, 30) + "...",
      //   tokenLength: token.length,
      //   tokenPrefix: token.substring(0, 10),
      //   room_id,
      //   user_id,
      //   app_id,
      // });

      // Join room
      try {
        await engine.joinRoom(
          token,
          room_id,
          { userId: user_id },
          {
            isAutoPublish: true,
            isAutoSubscribeAudio: true,
            roomProfileType: RoomProfileType.chat,
          },
        );
        // console.log("[RTC] joinRoom succeeded");
      } catch (joinErr: any) {
        // console.error("[RTC] joinRoom FAILED:", joinErr);
        // console.error("[RTC] joinRoom error code:", joinErr?.code);
        // console.error("[RTC] joinRoom error message:", joinErr?.message);
        // console.error("[RTC] joinRoom error name:", joinErr?.name);
        // console.error("[RTC] joinRoom full error:", JSON.stringify(joinErr, Object.getOwnPropertyNames(joinErr)));
        throw joinErr;
      }

      // Enable audio properties report (fires onLocal/RemoteAudioPropertiesReport periodically)
      try {
        (engine as any).enableAudioPropertiesReport?.({ interval: 500 });
        // console.log("[RTC] audio properties report enabled (500ms)");
      } catch (e) {
        // console.warn("[RTC] enableAudioPropertiesReport failed:", e);
        void e;
      }

      // List audio input devices (mic)
      try {
        await (VERTC as any).enumerateAudioCaptureDevices?.();
        // console.log("[RTC][DEV] mic devices:", devices?.length ?? "N/A",
        //   (devices ?? []).map((d: any) => ({ label: d.label, deviceId: d.deviceId?.slice(0, 8) })));
      } catch (e) {
        // console.warn("[RTC][DEV] enumerateAudioCaptureDevices failed:", e);
        void e;
      }

      // Start microphone and publish audio
      // console.log("[RTC] starting audio capture...");
      try {
        await engine.startAudioCapture();
        // console.log("[RTC][MIC] startAudioCapture OK");
      } catch (e) {
        // console.error("[RTC][MIC] startAudioCapture FAILED:", e);
        throw e;
      }
      engine.publishStream(MediaType.AUDIO);
      // console.log("[RTC] audio published");

      startTimeRef.current = Date.now();
      setIsCalling(true);
    } catch (err: any) {
      console.error("Error starting conversation:", err);
      const detail = err?.response?.data?.error || err?.message || "";

      // Bug 1 fix: Server Action ID 因服务器重新部署而失效 → 自动 reload 拿新 ID
      // 这是 Next.js Server Actions 的设计缺陷:client 端 action ID 在 build 时绑定,
      // deployment 后旧 ID 失效。catch 后自动刷新比让用户手动重试体验好
      if (
        detail.includes("Server Action") &&
        (detail.includes("was not found") || detail.includes("failed-to-find-server-action"))
      ) {
        toast.error(t("interview.versionStaleReloading"), { duration: 2000 });
        setTimeout(() => window.location.reload(), 1500);
        return;
      }

      // Bug 2 fix: getUserMedia NotAllowedError → 友好提示用户检查权限
      // iOS Edge / 用户拒绝权限 / OS 层禁了浏览器都可能触发
      if (err?.name === "NotAllowedError" || detail.includes("NotAllowedError")) {
        toast.error(t("interview.micCameraDenied"), { duration: 8000 });
        return;
      }

      toast.error(
        detail
          ? `${t("interview.startFailed")}: ${detail}`
          : t("interview.startFailed"),
        { duration: 6000 },
      );
    } finally {
      setLoading(false);
    }
  };

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------
  // 整页 gray-100，wrapper 不再 bg-white：原来 watermirror logo 落在 wrapper 的
  // 白底里，下沿和外围 gray 之间出现一段白条；去掉 bg-white 后 watermirror 自然
  // 坐在 gray 上，整页颜色统一
  // items-start 让 Card 贴顶不再有上方留白；外围背景从 gray 改 white（按用户要求）
  return (
    <div className="flex justify-center items-start min-h-screen bg-white pt-2">
      {isStarted && !isEnded && <TabSwitchWarning />}
      {/* Mobile: 整张 Card 锁定 100dvh（动态视口排除地址栏），flex-col + overflow-hidden 让内部不滚
          Desktop: 沿用 88vh 固定高度
          老 iOS Safari (<15.4) 不支持 dvh，回退到自然 min-h-screen */}
      <div className="md:w-[80%] w-full md:px-0 px-2">
        <Card className="h-[100dvh] md:h-[88vh] rounded-lg border-2 border-b-4 border-r-4 border-black text-xl font-bold transition-all dark:border-white flex flex-col overflow-hidden">
          <div className="flex flex-col flex-1 min-h-0">
            {/* 进度条 + 上方"小提示"气泡 —— 仅在面试已开始（isStarted）时渲染。
                填信息界面（!isStarted）不显示进度条，避免视觉干扰。
                shrink-0 防 mobile 锁屏时被字幕区挤压。 */}
            {isStarted && (
              <div className="m-4 shrink-0">
                {/* tip slot 高度 h-9 → h-14：mobile 上气泡能容纳两行不挤压进度条；
                    mb-3 跟进度条留 12px 喘息间距 */}
                <div className="relative h-14 md:h-9 mb-3 md:mb-2">
                  {activeTipIdx !== null && (
                    <div
                      key={activeTipIdx}
                      className={`absolute left-1/2 top-0 -translate-x-1/2 max-w-[350px] md:max-w-[92%] text-center px-4 py-2 rounded-2xl md:rounded-full bg-gradient-to-r from-indigo-50 via-purple-50 to-pink-50 border border-indigo-200/80 text-indigo-900 text-xs md:text-sm font-normal shadow-[0_4px_12px_-2px_rgba(99,102,241,0.18)] ${
                        tipPhase === "out" ? "tip-fade-out" : "tip-pop-in"
                      }`}
                    >
                      <span className="tip-emoji mr-1">💡</span>
                      <span className="font-semibold">{t("interview.tipPrefix")}</span>
                      {t(`interview.tipAt${TIP_THRESHOLDS[activeTipIdx]}`)}
                    </div>
                  )}
                </div>
                {/* Progress bar：渐变填充 + shimmer 高光，呼应小提示的紫粉色调
                    高度从 15px 缩到 8px 视觉更克制，rounded-full 全圆角，弱化"硬边框"感 */}
                <div className="relative h-2 rounded-full bg-indigo-100/70 overflow-hidden shadow-inner">
                  <div
                    className="progress-fill relative h-full rounded-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 transition-[width] duration-500 ease-out"
                    style={{
                      // 必须 clamp 到 100%：[TIME_UP] 发出之后到真正断开还有 ~25s grace period，
                      // 这段时间墙钟会超过 interviewTimeDuration*60，不 clamp 进度条会一直涨爆容器。
                      width: isEnded
                        ? "100%"
                        : `${Math.min(
                            100,
                            Math.max(
                              0,
                              (Number(currentTimeDuration) / (Number(interviewTimeDuration) * 60)) * 100,
                            ),
                          )}%`,
                    }}
                  />
                </div>
              </div>
            )}

            {/* CardHeader 加 shrink-0：mobile 锁屏时不被压扁；
                通话中（isStarted）时倒计时已经在进度条上方有显示，把这段隐藏避免重复占位 */}
            <CardHeader className="items-center p-1 shrink-0">
              {!isEnded && !isStarted && (
                <CardTitle className="flex flex-row items-center text-lg md:text-xl font-bold mb-2">
                  {interview?.name}
                </CardTitle>
              )}
              {!isEnded && !isStarted && (
                <div className="flex mt-2 flex-row">
                  <AlarmClockIcon
                    className="text-indigo-600 h-[1rem] w-[1rem] rotate-0 scale-100 dark:-rotate-90 dark:scale-0 mr-2 font-bold"
                    style={{ color: interview.theme_color }}
                  />
                  <div className="text-sm font-normal">
                    {t("interview.expectedDuration")}{" "}
                    <span className="font-bold" style={{ color: interview.theme_color }}>
                      {interviewTimeDuration} {t("interview.minsOrLess").split(" ")[0]}{" "}
                    </span>
                    {t("interview.minsOrLess").split(" ").slice(1).join(" ")}
                  </div>
                </div>
              )}
            </CardHeader>

            {/* Pre-call form
                Mobile 改造：
                  - logo h-40 → h-24（160→96px），不挤压表单
                  - description 字号 text-sm → text-base（mobile）
                  - input text-sm → text-base（防 iOS Safari 自动 zoom-in）
                  - input 宽度 75% → 90%（窄屏更易点）
                  - 按钮 h-10 → h-12（mobile 触摸目标 48px）
                  - flex-1 + overflow-y-auto：mobile 锁屏时表单内容多了能内部滚 */}
            {!isStarted && !isEnded && !isOldUser && (
              <div className="w-[95%] md:w-fit md:min-w-[400px] max-w-[600px] mx-auto mt-2 border border-indigo-200 rounded-md p-2 m-2 bg-slate-50 flex-1 min-h-0 overflow-y-auto md:flex-initial md:min-h-fit md:overflow-visible">
                <div>
                  <div className="flex justify-end p-1">
                    <LanguageSwitcher />
                  </div>
                  <div className="p-1 flex justify-center">
                    <Image
                      src={interview?.org_logo_url || "/watermirrorlogo.png"}
                      alt="Logo"
                      className="h-24 md:h-40 w-auto max-w-full object-contain"
                      width={560}
                      height={400}
                    />
                  </div>
                  <div className="p-2 font-normal text-base md:text-sm mb-4 whitespace-pre-line">
                    {/* description trim 后至少要有意义的内容（>= 5 字符）才显示
                        防止偶然的 "a"/"测试" 等占位文字漏到候选人页 */}
                    {(interview?.description ?? "").trim().length >= 5 && interview?.description}
                    <p className="font-bold text-base md:text-sm">
                      {"\n"}{t("interview.volumeNote")}
                      {"\n\n"}{t("interview.tabSwitchNote")}
                    </p>
                  </div>
                  {!interview?.is_anonymous && (
                    <div className="flex flex-col gap-3 justify-center">
                      <div className="flex justify-center">
                        <input
                          value={email}
                          className="h-fit mx-auto py-3 md:py-2 border-2 rounded-md w-[90%] md:w-[75%] self-center px-3 border-gray-400 text-base md:text-sm font-normal"
                          placeholder={t("interview.enterEmail")}
                          onChange={(e) => setEmail(e.target.value)}
                        />
                      </div>
                      <div className="flex justify-center">
                        <input
                          value={name}
                          className="h-fit mb-4 mx-auto py-3 md:py-2 border-2 rounded-md w-[90%] md:w-[75%] self-center px-3 border-gray-400 text-base md:text-sm font-normal"
                          placeholder={t("interview.enterFirstName")}
                          onChange={(e) => setName(e.target.value)}
                        />
                      </div>
                    </div>
                  )}
                </div>
                <div className="w-[90%] md:w-[80%] flex flex-row gap-2 mx-auto justify-center items-center align-middle">
                  <Button
                    className="min-w-20 h-12 md:h-10 rounded-lg flex flex-row justify-center mb-8 font-bold text-base md:text-sm"
                    style={{
                      backgroundColor: interview.theme_color ?? "#4F46E5",
                      color: isLightColor(interview.theme_color ?? "#4F46E5") ? "black" : "white",
                    }}
                    disabled={Loading || (!interview?.is_anonymous && (!isValidEmail || !name))}
                    onClick={startConversation}
                  >
                    {!Loading ? t("interview.startInterview") : <MiniLoader />}
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger>
                      <Button
                        className="bg-white border text-black min-w-15 h-12 md:h-10 rounded-lg flex flex-row justify-center mb-8 text-base md:text-sm"
                        style={{ borderColor: interview.theme_color }}
                        disabled={Loading}
                      >
                        {t("interview.exit")}
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>{t("common.areYouSure")}</AlertDialogTitle>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
                        <AlertDialogAction
                          className="bg-indigo-600 hover:bg-indigo-800 font-bold"
                          onClick={onEndCallClick}
                        >
                          {t("common.continue")}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            )}

            {/* Active call UI ——
                Mobile: 上方两个字幕区平分剩余高度,中间一条柔和分隔线;
                       底部 AI + 候选人头像并排,整屏不滚
                Desktop: 沿用左右 50/50,每边字幕在上头像在下 */}
            {isStarted && !isEnded && !isOldUser && (
              <>
                {/* ===== MOBILE LAYOUT ===== */}
                <div className="md:hidden flex flex-col flex-1 min-h-0 overflow-hidden p-2">
                  {/* 字幕区:上下平分 */}
                  <div className="flex flex-col flex-1 min-h-0">
                    {/* AI 字幕 */}
                    <div className="flex-1 min-h-0 overflow-y-auto text-base leading-relaxed px-3 py-2 mx-auto w-[92%]">
                      {lastInterviewerResponse}
                    </div>
                    {/* 柔和分隔线,替代原 border-b-2 */}
                    <div className="border-b border-gray-200 mx-3 my-1" />
                    {/* 你字幕 */}
                    <div
                      ref={setUserResponseRef}
                      className="flex-1 min-h-0 overflow-y-auto text-base leading-relaxed px-3 py-2 mx-auto w-[92%]"
                    >
                      {lastUserResponse}
                    </div>
                  </div>

                  {/* 头像并排底部 */}
                  <div className="flex flex-row justify-center gap-10 shrink-0 pt-3 pb-1 border-t border-gray-200">
                    {/* AI 头像 + label */}
                    <div className="flex flex-col items-center">
                      {interviewerImg ? (
                        <img
                          src={interviewerImg}
                          alt="Image of the interviewer"
                          width={90}
                          height={90}
                          className={`w-[90px] h-[90px] object-cover object-center rounded-full ${
                            activeTurn === "agent" ? "border-4 talking-pulse" : ""
                          }`}
                          style={
                            activeTurn === "agent"
                              ? { borderColor: interview.theme_color ?? "#4F46E5" }
                              : undefined
                          }
                          onError={(e) => {
                            (e.currentTarget as HTMLImageElement).style.display = "none";
                          }}
                        />
                      ) : (
                        <div className="w-[90px] h-[90px] bg-gray-200 rounded-full animate-pulse" />
                      )}
                      <div className="font-semibold text-xs mt-2">{t("interview.interviewer")}</div>
                    </div>

                    {/* 你头像 (video) + label */}
                    <div className="flex flex-col items-center">
                      <video
                        ref={videoRefMobile}
                        autoPlay
                        playsInline
                        muted
                        className={`w-[90px] h-[90px] object-cover rounded-full ${
                          activeTurn === "user" ? "border-4 talking-pulse" : ""
                        }`}
                        style={{
                          transform: "scaleX(-1)",
                          ...(activeTurn === "user"
                            ? { borderColor: interview.theme_color ?? "#4F46E5" }
                            : {}),
                        }}
                      />
                      <div className="font-semibold text-xs mt-2">{t("interview.you")}</div>
                    </div>
                  </div>
                </div>

                {/* ===== DESKTOP LAYOUT ===== */}
                <div className="hidden md:flex md:flex-row p-2 flex-1 min-h-0 overflow-hidden">
                  {/* AI 区 (左) */}
                  <div className="border-x-2 border-grey w-[50%] my-auto min-h-[70%]">
                    <div className="flex flex-col justify-evenly">
                      <div className="text-[17px] w-[80%] leading-relaxed mt-4 h-[250px] mx-auto px-6 overflow-y-auto">
                        {lastInterviewerResponse}
                      </div>
                      <div className="flex flex-col mx-auto justify-center items-center mt-auto pt-6">
                        {interviewerImg ? (
                          <img
                            src={interviewerImg}
                            alt="Image of the interviewer"
                            width={160}
                            height={160}
                            className={`w-[160px] h-[160px] object-cover object-center rounded-full mx-auto ${
                              activeTurn === "agent" ? "border-4 talking-pulse" : ""
                            }`}
                            style={
                              activeTurn === "agent"
                                ? { borderColor: interview.theme_color ?? "#4F46E5" }
                                : undefined
                            }
                            onError={(e) => {
                              (e.currentTarget as HTMLImageElement).style.display = "none";
                            }}
                          />
                        ) : (
                          <div className="w-[160px] h-[160px] bg-gray-200 rounded-full animate-pulse mx-auto" />
                        )}
                        <div className="font-semibold text-base mt-2">{t("interview.interviewer")}</div>
                      </div>
                    </div>
                  </div>

                  {/* 你区 (右) */}
                  <div className="flex flex-col w-[50%] justify-evenly">
                    <div
                      ref={setUserResponseRef}
                      className="text-[17px] w-[80%] leading-relaxed mt-4 mx-auto h-[250px] px-6 overflow-y-auto"
                    >
                      {lastUserResponse}
                    </div>
                    <div className="flex flex-col mx-auto justify-center items-center mt-auto pt-6">
                      <video
                        ref={videoRefDesktop}
                        autoPlay
                        playsInline
                        muted
                        className={`w-[160px] h-[160px] object-cover rounded-full mx-auto ${
                          activeTurn === "user" ? "border-4 talking-pulse" : ""
                        }`}
                        style={{
                          transform: "scaleX(-1)",
                          ...(activeTurn === "user"
                            ? { borderColor: interview.theme_color ?? "#4F46E5" }
                            : {}),
                        }}
                      />
                      <div className="font-semibold text-base mt-2">{t("interview.you")}</div>
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* End call button —— shrink-0 固定底部不被压扁；
                mobile 按钮 h-12（48px 触摸目标），mb 收紧到 mb-2 节省空间，desktop 沿用 mb-8 */}
            {isStarted && !isEnded && !isOldUser && (
              <div className="items-center p-2 shrink-0">
                <AlertDialog>
                  <AlertDialogTrigger className="w-full">
                    <Button
                      className="bg-white text-black border border-indigo-600 h-12 md:h-10 mx-auto flex flex-row justify-center mb-3 md:mb-8 transition-transform duration-200 hover:scale-105 text-base md:text-sm"
                      disabled={Loading}
                    >
                      {t("interview.endInterview")}{" "}
                      <XCircleIcon className="h-[1.5rem] ml-2 w-[1.5rem] rotate-0 scale-100 dark:-rotate-90 dark:scale-0 text-red" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>{t("common.areYouSure")}</AlertDialogTitle>
                      <AlertDialogDescription>{t("interview.endCallConfirm")}</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
                      <AlertDialogAction
                        className="bg-indigo-600 hover:bg-indigo-800"
                        onClick={onEndCallClick}
                      >
                        {t("common.confirm")}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            )}

            {/* Post-call thank you */}
            {isEnded && !isOldUser && (
              <div className="w-[90%] md:w-fit md:min-w-[400px] md:max-w-[400px] mx-auto mt-2 border border-indigo-200 rounded-md p-2 m-2 bg-slate-50 absolute -translate-x-1/2 -translate-y-1/2 top-1/2 left-1/2">
                <div>
                  <div className="p-2 font-normal text-base mb-4 whitespace-pre-line">
                    <CheckCircleIcon className="h-[2rem] w-[2rem] mx-auto my-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0 text-indigo-500" />
                    <p className="text-lg font-semibold text-center">
                      {isStarted ? t("interview.thankYouParticipate") : t("interview.thankYouConsidering")}
                    </p>
                    <p className="text-center">
                      {"\n"}
                      {t("interview.closeTab")}
                    </p>
                  </div>
                  {!isFeedbackSubmitted && (
                    <AlertDialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                      <AlertDialogTrigger className="w-full flex justify-center">
                        <Button
                          className="bg-indigo-600 text-white h-10 mt-4 mb-4 font-bold"
                          onClick={() => setIsDialogOpen(true)}
                        >
                          {t("interview.provideFeedback")}
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <FeedbackForm email={email} onSubmit={handleFeedbackSubmit} />
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                </div>
              </div>
            )}

            {/* Already responded */}
            {isOldUser && !isInterviewFull && (
              <div className="w-[90%] md:w-fit md:min-w-[400px] md:max-w-[400px] mx-auto mt-2 border border-indigo-200 rounded-md p-2 m-2 bg-slate-50 absolute -translate-x-1/2 -translate-y-1/2 top-1/2 left-1/2">
                <div>
                  <div className="p-2 font-normal text-base mb-4 whitespace-pre-line">
                    <CheckCircleIcon className="h-[2rem] w-[2rem] mx-auto my-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0 text-indigo-500" />
                    <p className="text-lg font-semibold text-center">{t("interview.alreadyResponded")}</p>
                    <p className="text-center">
                      {"\n"}
                      {t("interview.closeTab")}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Interview full (max 10 participants) */}
            {isInterviewFull && (
              <div className="w-[90%] md:w-fit md:min-w-[400px] md:max-w-[400px] mx-auto mt-2 border border-indigo-200 rounded-md p-2 m-2 bg-slate-50 absolute -translate-x-1/2 -translate-y-1/2 top-1/2 left-1/2">
                <div>
                  <div className="p-2 font-normal text-base mb-4 whitespace-pre-line">
                    <XCircleIcon className="h-[2rem] w-[2rem] mx-auto my-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0 text-red-500" />
                    <p className="text-lg font-semibold text-center">{t("interview.interviewFull")}</p>
                    <p className="text-center">
                      {"\n"}
                      {t("interview.closeTab")}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </Card>

        <div className="flex flex-row justify-center align-middle mt-3">
          <img
            src="/watermirrorlogo.png"
            alt="WaterMirror"
            className="h-12 w-auto flex-none"
            style={{ background: "transparent" }}
          />
        </div>
      </div>
    </div>
  );
}

export default Call;
