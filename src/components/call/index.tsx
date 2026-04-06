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
import { parseSubtitleMessage } from "@/lib/volcengine-rtc";
import { isLightColor, testEmail } from "@/lib/utils";
import { submitFeedback } from "@/services/feedback.service";
import { getInterviewer } from "@/services/interviewers.service";
import { getAllEmails, saveResponse } from "@/services/responses.service";
import type { Interview } from "@/types/interview";
import type { FeedbackData } from "@/types/response";
import VERTC, { MediaType, RoomProfileType } from "@volcengine/rtc";
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

// Accumulated transcript entry
type TranscriptEntry = {
  role: "agent" | "user";
  content: string;
};

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

  // Timer
  const [time, setTime] = useState(0);
  const [currentTimeDuration, setCurrentTimeDuration] = useState("0");
  const [interviewTimeDuration, setInterviewTimeDuration] = useState("1");

  // UI state
  const [interviewerImg, setInterviewerImg] = useState("");
  const [isFeedbackSubmitted, setIsFeedbackSubmitted] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const { tabSwitchCount } = useTabSwitchPrevention();
  const lastUserResponseRef = useRef<HTMLDivElement | null>(null);

  // RTC engine ref (created once per mount)
  const engineRef = useRef<ReturnType<typeof VERTC.createEngine> | null>(null);
  const agentUserIdRef = useRef<string>("");
  const localUserIdRef = useRef<string>("");
  const localVideoRef = useRef<HTMLDivElement | null>(null);

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
  // Timer
  // -------------------------------------------------------------------------
  // biome-ignore lint/correctness/useExhaustiveDependencies: intentional timer deps
  useEffect(() => {
    let intervalId: ReturnType<typeof setInterval>;
    if (isCalling) {
      intervalId = setInterval(() => setTime((t) => t + 1), 10);
    }
    setCurrentTimeDuration(String(Math.floor(time / 100)));
    if (Number(currentTimeDuration) === Number(interviewTimeDuration) * 60) {
      handleEndCall();
    }
    return () => clearInterval(intervalId);
  }, [isCalling, time, currentTimeDuration]);

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
  // Fetch interviewer image
  // -------------------------------------------------------------------------
  useEffect(() => {
    const fetchInterviewer = async () => {
      const interviewer = await getInterviewer(interview.interviewer_id);
      setInterviewerImg(interviewer.image);
    };
    fetchInterviewer();
  }, [interview.interviewer_id]);

  // -------------------------------------------------------------------------
  // Save response when call ends
  // -------------------------------------------------------------------------
  // biome-ignore lint/correctness/useExhaustiveDependencies: intentional
  useEffect(() => {
    console.log("[REPORT] isEnded changed:", isEnded, "callId:", callId || "(empty)");
    if (isEnded && callId) {
      const persist = async () => {
        const endTs = Date.now();
        const entries = transcriptRef.current;
        console.log("[REPORT] persisting response, transcript entries:", entries.length);
        console.log("[REPORT] transcript preview:", JSON.stringify(entries.slice(0, 3)));

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
                })),
                start_timestamp: startTimeRef.current,
                end_timestamp: endTs,
              },
            },
            callId,
          );
          console.log("[REPORT] saveResponse succeeded for callId:", callId);
        } catch (err) {
          console.error("[REPORT] saveResponse FAILED:", err);
        }
      };
      persist();
    } else if (isEnded && !callId) {
      console.warn("[REPORT] isEnded=true but callId is empty — saveResponse skipped!");
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
  // End call (shared logic)
  // -------------------------------------------------------------------------
  const handleEndCall = useCallback(async () => {
    try {
      const engine = engineRef.current;
      if (engine) {
        try {
          await engine.stopVideoCapture();
        } catch { /* ignore */ }
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
  }, [roomId, taskId]);

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
    try {
      const oldUserEmails: string[] = (await getAllEmails(interview.id)).map((item) => item.email);
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
        questions: interview?.questions.map((q) => q.question).join(", "),
        name: name || "not provided",
        language: interview?.language ?? "zh",
      };

      const registerRes: RegisterCallResponse = await axios.post("/api/register-call", {
        dynamic_data: data,
        interviewer_id: interview?.interviewer_id,
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
      localUserIdRef.current = user_id;

      // Create response record in DB
      await createResponse({
        interview_id: interview.id,
        call_id,
        email,
        name,
      });

      // -----------------------------------------------------------------------
      // Initialize ByteRTC engine
      // -----------------------------------------------------------------------
      console.log("[RTC] createEngine with appId:", app_id);
      const engine = VERTC.createEngine(app_id);
      engineRef.current = engine;

      // Subscribe to audio streams from other participants (the AI agent)
      engine.on(VERTC.events.onUserPublishStream, async ({ userId, mediaType }) => {
        console.log("[RTC] onUserPublishStream:", userId, mediaType);
        if (mediaType === MediaType.AUDIO) {
          await engine.subscribeStream(userId, MediaType.AUDIO);
          setActiveTurn("agent");
        }
      });

      engine.on(VERTC.events.onUserUnpublishStream, ({ userId }) => {
        console.log("[RTC] onUserUnpublishStream:", userId);
        if (userId === agentUserIdRef.current) {
          setActiveTurn("user");
        }
      });

      // Receive subtitle / transcript binary messages
      engine.on(VERTC.events.onRoomBinaryMessageReceived, (event: any) => {
        console.log("[RTC] onRoomBinaryMessageReceived fired, event keys:", Object.keys(event));
        const message = event.message ?? event.binaryMessage ?? event;
        const userId = event.userId ?? event.uid ?? "";
        console.log("[RTC] binary message from:", userId, "size:", message?.byteLength ?? "N/A");
        const parsed = parseSubtitleMessage(message, userId as string, agentUserIdRef.current);
        if (!parsed) return;

        if (parsed.role === "agent") {
          setActiveTurn("agent");
          setLastInterviewerResponse(parsed.text);
          if (parsed.isFinal) {
            transcriptRef.current.push({ role: "agent", content: parsed.text });
          }
        } else {
          setActiveTurn("user");
          setLastUserResponse(parsed.text);
          if (parsed.isFinal) {
            transcriptRef.current.push({ role: "user", content: parsed.text });
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
          console.log("[RTC][MIC] local volume:", level, "raw:", JSON.stringify(event).substring(0, 200));
        }
      });

      // Debug: monitor remote audio activity (to confirm agent audio arriving)
      let remoteVolLogCount = 0;
      engine.on(VERTC.events.onRemoteAudioPropertiesReport, (event: any) => {
        if (remoteVolLogCount++ % 20 === 0) {
          console.log("[RTC][SPK] remote volume report:", JSON.stringify(event).substring(0, 200));
        }
      });

      // Local audio state (capture / device change)
      engine.on(VERTC.events.onLocalAudioStateChanged as any, (event: any) => {
        console.log("[RTC][MIC] onLocalAudioStateChanged:", JSON.stringify(event));
      });

      // User start/stop audio capture
      engine.on(VERTC.events.onUserStartAudioCapture as any, (event: any) => {
        console.log("[RTC][MIC] onUserStartAudioCapture:", JSON.stringify(event));
      });
      engine.on(VERTC.events.onUserStopAudioCapture as any, (event: any) => {
        console.log("[RTC][MIC] onUserStopAudioCapture:", JSON.stringify(event));
      });

      // Audio device warning (mic blocked, no permission, etc.)
      engine.on(VERTC.events.onAudioDeviceStateChanged as any, (event: any) => {
        console.log("[RTC][DEV] onAudioDeviceStateChanged:", JSON.stringify(event));
      });

      // Debug: user message (non-binary)
      engine.on(VERTC.events.onUserMessageReceived, (event: any) => {
        console.log("[RTC] onUserMessageReceived:", JSON.stringify(event).substring(0, 300));
      });

      // Debug: room message (non-binary)
      engine.on(VERTC.events.onRoomMessageReceived, (event: any) => {
        console.log("[RTC] onRoomMessageReceived:", JSON.stringify(event).substring(0, 300));
      });

      engine.on(VERTC.events.onError, (error) => {
        console.error("[RTC] onError event:", JSON.stringify(error));
        handleEndCall();
      });

      // 详细诊断日志
      console.log("[RTC] joinRoom params:", {
        token: token.substring(0, 30) + "...",
        tokenLength: token.length,
        tokenPrefix: token.substring(0, 10),
        room_id,
        user_id,
        app_id,
      });

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
        console.log("[RTC] joinRoom succeeded");
      } catch (joinErr: any) {
        console.error("[RTC] joinRoom FAILED:", joinErr);
        console.error("[RTC] joinRoom error code:", joinErr?.code);
        console.error("[RTC] joinRoom error message:", joinErr?.message);
        console.error("[RTC] joinRoom error name:", joinErr?.name);
        console.error("[RTC] joinRoom full error:", JSON.stringify(joinErr, Object.getOwnPropertyNames(joinErr)));
        throw joinErr;
      }

      // Enable audio properties report (fires onLocal/RemoteAudioPropertiesReport periodically)
      try {
        (engine as any).enableAudioPropertiesReport?.({ interval: 500 });
        console.log("[RTC] audio properties report enabled (500ms)");
      } catch (e) {
        console.warn("[RTC] enableAudioPropertiesReport failed:", e);
      }

      // List audio input devices (mic)
      try {
        const devices = await (VERTC as any).enumerateAudioCaptureDevices?.();
        console.log("[RTC][DEV] mic devices:", devices?.length ?? "N/A",
          (devices ?? []).map((d: any) => ({ label: d.label, deviceId: d.deviceId?.slice(0, 8) })));
      } catch (e) {
        console.warn("[RTC][DEV] enumerateAudioCaptureDevices failed:", e);
      }

      // Start microphone and publish audio
      console.log("[RTC] starting audio capture...");
      try {
        await engine.startAudioCapture();
        console.log("[RTC][MIC] startAudioCapture OK");
      } catch (e) {
        console.error("[RTC][MIC] startAudioCapture FAILED:", e);
        throw e;
      }
      engine.publishStream(MediaType.AUDIO);
      console.log("[RTC] audio published");

      // Start local camera preview (local only, not transmitted to AI agent)
      try {
        await engine.startVideoCapture();
        if (localVideoRef.current) {
          (engine as any).setLocalVideoPlayer(user_id, {
            renderDom: localVideoRef.current,
            renderMode: 1, // 1 = fit
            mirrorType: 2, // 2 = mirror (selfie mode)
          });
        }
        engine.publishStream(MediaType.VIDEO);
        console.log("[RTC] video capture started");
      } catch (e) {
        console.warn("[RTC] video capture failed (may not be available):", e);
      }

      startTimeRef.current = Date.now();
      setIsCalling(true);
      setIsStarted(true);
    } catch (err: any) {
      console.error("Error starting conversation:", err);
      const detail = err?.response?.data?.error || err?.message || "";
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
  return (
    <div className="flex justify-center items-center min-h-screen bg-gray-100">
      {isStarted && <TabSwitchWarning />}
      <div className="bg-white rounded-md md:w-[80%] w-[90%]">
        <Card className="h-[88vh] rounded-lg border-2 border-b-4 border-r-4 border-black text-xl font-bold transition-all md:block dark:border-white">
          <div>
            {/* Progress bar */}
            <div className="m-4 h-[15px] rounded-lg border-[1px] border-black">
              <div
                className="bg-indigo-600 h-[15px] rounded-lg"
                style={{
                  width: isEnded
                    ? "100%"
                    : `${(Number(currentTimeDuration) / (Number(interviewTimeDuration) * 60)) * 100}%`,
                }}
              />
            </div>

            <CardHeader className="items-center p-1">
              {!isEnded && (
                <CardTitle className="flex flex-row items-center text-lg md:text-xl font-bold mb-2">
                  {interview?.name}
                </CardTitle>
              )}
              {!isEnded && (
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

            {/* Pre-call form */}
            {!isStarted && !isEnded && !isOldUser && (
              <div className="w-fit min-w-[400px] max-w-[600px] mx-auto mt-2 border border-indigo-200 rounded-md p-2 m-2 bg-slate-50">
                <div>
                  <div className="flex justify-end p-1">
                    <LanguageSwitcher />
                  </div>
                  {interview?.logo_url && (
                    <div className="p-1 flex justify-center">
                      <Image
                        src={interview?.logo_url}
                        alt="Logo"
                        className="h-40 w-auto max-w-full object-contain"
                        width={560}
                        height={400}
                      />
                    </div>
                  )}
                  <div className="p-2 font-normal text-sm mb-4 whitespace-pre-line">
                    {interview?.description}
                    <p className="font-bold text-sm">
                      {"\n"}{t("interview.volumeNote")}
                      {"\n\n"}{t("interview.tabSwitchNote")}
                    </p>
                  </div>
                  {!interview?.is_anonymous && (
                    <div className="flex flex-col gap-2 justify-center">
                      <div className="flex justify-center">
                        <input
                          value={email}
                          className="h-fit mx-auto py-2 border-2 rounded-md w-[75%] self-center px-2 border-gray-400 text-sm font-normal"
                          placeholder={t("interview.enterEmail")}
                          onChange={(e) => setEmail(e.target.value)}
                        />
                      </div>
                      <div className="flex justify-center">
                        <input
                          value={name}
                          className="h-fit mb-4 mx-auto py-2 border-2 rounded-md w-[75%] self-center px-2 border-gray-400 text-sm font-normal"
                          placeholder={t("interview.enterFirstName")}
                          onChange={(e) => setName(e.target.value)}
                        />
                      </div>
                    </div>
                  )}
                </div>
                <div className="w-[80%] flex flex-row mx-auto justify-center items-center align-middle">
                  <Button
                    className="min-w-20 h-10 rounded-lg flex flex-row justify-center mb-8 font-bold"
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
                        className="bg-white border ml-2 text-black min-w-15 h-10 rounded-lg flex flex-row justify-center mb-8"
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

            {/* Active call UI */}
            {isStarted && !isEnded && !isOldUser && (
              <div className="flex flex-row p-2 grow">
                <div className="border-x-2 border-grey w-[50%] my-auto min-h-[70%]">
                  <div className="flex flex-col justify-evenly">
                    <div className="text-[22px] w-[80%] md:text-[26px] mt-4 min-h-[250px] mx-auto px-6">
                      {lastInterviewerResponse}
                    </div>
                    <div className="flex flex-col mx-auto justify-center items-center align-middle">
                      {interviewerImg ? (
                        <Image
                          src={interviewerImg}
                          alt="Image of the interviewer"
                          width={120}
                          height={120}
                          className={`object-cover object-center mx-auto my-auto ${
                            activeTurn === "agent"
                              ? `border-4 border-[${interview.theme_color}] rounded-full`
                              : ""
                          }`}
                        />
                      ) : (
                        <div className="w-[120px] h-[120px] bg-gray-200 rounded-full animate-pulse mx-auto" />
                      )}
                      <div className="font-semibold">{t("interview.interviewer")}</div>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col justify-evenly w-[50%]">
                  <div
                    ref={lastUserResponseRef}
                    className="text-[22px] w-[80%] md:text-[26px] mt-4 mx-auto h-[250px] px-6 overflow-y-auto"
                  >
                    {lastUserResponse}
                  </div>
                  <div className="flex flex-col mx-auto justify-center items-center align-middle">
                    <div
                      ref={localVideoRef}
                      className={`w-[120px] h-[120px] rounded-full overflow-hidden bg-gray-200 mx-auto my-auto ${
                        activeTurn === "user"
                          ? `border-4 border-[${interview.theme_color}]`
                          : ""
                      }`}
                    />
                    <div className="font-semibold">{t("interview.you")}</div>
                  </div>
                </div>
              </div>
            )}

            {/* End call button */}
            {isStarted && !isEnded && !isOldUser && (
              <div className="items-center p-2">
                <AlertDialog>
                  <AlertDialogTrigger className="w-full">
                    <Button
                      className="bg-white text-black border border-indigo-600 h-10 mx-auto flex flex-row justify-center mb-8"
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
                        {t("common.continue")}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            )}

            {/* Post-call thank you */}
            {isEnded && !isOldUser && (
              <div className="w-fit min-w-[400px] max-w-[400px] mx-auto mt-2 border border-indigo-200 rounded-md p-2 m-2 bg-slate-50 absolute -translate-x-1/2 -translate-y-1/2 top-1/2 left-1/2">
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
            {isOldUser && (
              <div className="w-fit min-w-[400px] max-w-[400px] mx-auto mt-2 border border-indigo-200 rounded-md p-2 m-2 bg-slate-50 absolute -translate-x-1/2 -translate-y-1/2 top-1/2 left-1/2">
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
          </div>
        </Card>

        <div className="flex flex-row justify-center align-middle mt-3">
          <div className="text-center text-md font-semibold mr-2">
            {t("common.poweredBy")}
          </div>
          <Image
            src="/watermirrorlogo.png"
            alt="WaterMirror"
            width={100}
            height={30}
            className="h-6 w-auto"
          />
        </div>
      </div>
    </div>
  );
}

export default Call;
