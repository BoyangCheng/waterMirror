"use client";

import CallInfo, { type VideoDataPayload } from "@/components/call/callInfo";
import VideoPlayer, { type VideoPlayerHandle } from "@/components/call/videoPlayer";
import Modal from "@/components/dashboard/Modal";
import EditInterview from "@/components/dashboard/interview/editInterview";
import SummaryInfo from "@/components/dashboard/interview/summaryInfo";
import LoaderWithText from "@/components/loaders/loader-with-text/loaderWithText";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useInterviews } from "@/contexts/interviews.context";
import { useI18n } from "@/i18n";
import { CandidateStatus } from "@/lib/enum";
import { formatTimestampToDateHHMM } from "@/lib/utils";
import { useOrg } from "@/contexts/auth.context";
import { getOrganizationById } from "@/services/clients.service";
import { updateInterview } from "@/services/interviews.service";
import { getAllResponses, getResponsesByJobId, saveResponse } from "@/services/responses.service";
import type { Interview } from "@/types/interview";
import type { Response } from "@/types/response";
import { Eye, Filter, Palette, Pencil, Share2, UserIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import React, { useEffect, useMemo, useRef, useState, use } from "react";
import { ChromePicker } from "react-color";
import { toast } from "sonner";

interface Props {
  params: Promise<{
    interviewId: string;
  }>;
  searchParams: Promise<{
    call: string;
    edit: boolean;
  }>;
}

const base_url = process.env.NEXT_PUBLIC_LIVE_URL;

function InterviewHome({ params, searchParams }: Props) {
  const resolvedParams = use(params);
  const resolvedSearchParams = use(searchParams);
  const [interview, setInterview] = useState<Interview>();
  const [responses, setResponses] = useState<Response[]>();
  const { getInterviewById } = useInterviews();
  // 分享按钮短暂的"已复制"视觉反馈
  const [shareCopied, setShareCopied] = useState(false);
  const router = useRouter();
  const [isActive, setIsActive] = useState<boolean>(true);
  const [currentPlan, setCurrentPlan] = useState<string>("");
  const [isGeneratingInsights, setIsGeneratingInsights] = useState<boolean>(false);
  const [isViewed, setIsViewed] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [showColorPicker, setShowColorPicker] = useState<boolean>(false);
  const [themeColor, setThemeColor] = useState<string>("#4F46E5");
  const [iconColor, seticonColor] = useState<string>("#4F46E5");
  const { organization } = useOrg();
  const [filterStatus, setFilterStatus] = useState<string>("ALL");

  // ── 视频播放器状态（提升到父页面，左侧栏渲染） ────────────────────────────
  const [videoData, setVideoData] = useState<VideoDataPayload>({
    videoUrl: null,
    videoDurationMs: 0,
    turns: [],
  });
  const [isVideoOpen, setIsVideoOpen] = useState(false);
  const [currentVideoSec, setCurrentVideoSec] = useState(0);
  const [initialSeekSec, setInitialSeekSec] = useState(0);
  const videoPlayerRef = useRef<VideoPlayerHandle>(null);

  // 切换面试 / 切换 call 时关闭播放器避免状态串
  useEffect(() => {
    setIsVideoOpen(false);
    setCurrentVideoSec(0);
    setInitialSeekSec(0);
  }, [resolvedSearchParams.call]);

  // Q/A markers：从 turns 派生
  const videoMarkers = useMemo(
    () =>
      videoData.turns
        .filter((t) => t.offsetMs > 0) // 0 都是首句或老数据，画在最左 0 位置没意义
        .map((t) => ({ offsetMs: t.offsetMs, role: t.role as "agent" | "user" })),
    [videoData.turns],
  );

  const onOpenVideo = (initialSec: number) => {
    setInitialSeekSec(initialSec);
    setIsVideoOpen(true);
  };

  const onSeekToTurn = (turnIndex: number) => {
    const turn = videoData.turns[turnIndex];
    if (!turn) return;
    const sec = turn.offsetMs / 1000;
    if (isVideoOpen && videoPlayerRef.current) {
      videoPlayerRef.current.seek(sec);
    } else {
      onOpenVideo(sec);
    }
  };

  const { t } = useI18n();

  const seeInterviewPreviewPage = () => {
    const protocol = base_url?.includes("localhost") ? "http" : "https";
    if (interview?.url) {
      const url = interview?.readable_slug
        ? `${protocol}://${base_url}/call/${interview?.readable_slug}`
        : interview.url.startsWith("http")
          ? interview.url
          : `https://${interview.url}`;
      window.open(url, "_blank");
    } else {
      console.error("Interview URL is null or undefined.");
    }
  };

  useEffect(() => {
    const fetchInterview = async () => {
      try {
        const response = await getInterviewById(resolvedParams.interviewId);
        setInterview(response);
        setIsActive(response.is_active);
        setIsViewed(response.is_viewed);
        setThemeColor(response.theme_color ?? "#4F46E5");
        seticonColor(response.theme_color ?? "#4F46E5");
        setLoading(true);
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };
    if (!interview || !isGeneratingInsights) {
      fetchInterview();
    }
  // biome-ignore lint/correctness/useExhaustiveDependencies: intentionally omit interview from deps to prevent infinite fetch loop
  }, [getInterviewById, resolvedParams.interviewId, isGeneratingInsights]);

  useEffect(() => {
    const fetchOrganizationData = async () => {
      try {
        if (organization?.id) {
          const data = await getOrganizationById(organization.id);
          if (data?.plan) {
            setCurrentPlan(data.plan);
          }
        }
      } catch (error) {
        console.error("Error fetching organization data:", error);
      }
    };

    fetchOrganizationData();
  }, [organization]);
  // 当当前面试有 job_id 时，把同岗位下所有面试的 response 合并到左侧列表，
  // 以便用户在 a/b 之间快速对比同岗位候选人。没有 job_id 时退回到原来的"只显示本面试"。
  useEffect(() => {
    const fetchResponses = async () => {
      try {
        let merged: Response[] = [];
        if (interview?.job_id && interview.organization_id) {
          merged = (await getResponsesByJobId(
            interview.job_id,
            interview.organization_id,
          )) as Response[];
        } else {
          merged = await getAllResponses(resolvedParams.interviewId);
        }
        setResponses(merged);
        setLoading(true);

        // 异步更新 response_count 到面试表 —— 用本面试的 response 数（merged 里要过滤）
        const ownResponses = merged.filter(
          (r) => r.interview_id === resolvedParams.interviewId,
        );
        updateInterview(
          { response_count: ownResponses.length },
          resolvedParams.interviewId,
        ).catch(console.error);

        // 异步触发未分析回复的 get-call，不阻塞 UI
        for (const r of merged) {
          if (!r.is_analysed) {
            fetch("/api/get-call", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ id: r.call_id }),
            }).catch((err) =>
              console.error(`Failed get-call for ${r.call_id}:`, err),
            );
          }
        }
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };

    // 等 interview 拉到再决定走哪个分支
    if (interview) fetchResponses();
  }, [resolvedParams.interviewId, interview]);

  const handleDeleteResponse = (deletedCallId: string) => {
    if (responses) {
      setResponses(responses.filter((response) => response.call_id !== deletedCallId));
      if (resolvedSearchParams.call === deletedCallId) {
        router.push(`/interviews/${resolvedParams.interviewId}`);
      }
    }
  };

  const handleResponseClick = async (response: Response) => {
    try {
      await saveResponse({ is_viewed: true }, response.call_id);
      if (responses) {
        const updatedResponses = responses.map((r) =>
          r.call_id === response.call_id ? { ...r, is_viewed: true } : r,
        );
        setResponses(updatedResponses);
      }
      setIsViewed(true);
    } catch (error) {
      console.error(error);
    }
  };

  const handleToggle = async () => {
    try {
      const updatedIsActive = !isActive;
      setIsActive(updatedIsActive);

      await updateInterview(
        { is_active: updatedIsActive },
        resolvedParams.interviewId,
      );

      toast.success(t("interview.statusUpdated"), {
        description: updatedIsActive ? t("interview.statusNowActive") : t("interview.statusNowInactive"),
        position: "bottom-right",
        duration: 3000,
      });
    } catch (error) {
      console.error(error);
      toast.error(t("common.error"), {
        description: t("statusUpdateFailed"),
        duration: 3000,
      });
    }
  };

  const handleThemeColorChange = async (newColor: string) => {
    try {
      await updateInterview({ theme_color: newColor }, resolvedParams.interviewId);

      toast.success(t("interview.themeUpdated"), {
        position: "bottom-right",
        duration: 3000,
      });
    } catch (error) {
      console.error(error);
      toast.error(t("common.error"), {
        description: t("interview.themeUpdateFailed"),
        duration: 3000,
      });
    }
  };

  const handleCandidateStatusChange = (callId: string, newStatus: string) => {
    setResponses((prevResponses) => {
      return prevResponses?.map((response) =>
        response.call_id === callId ? { ...response, candidate_status: newStatus } : response,
      );
    });
  };

  // 复用 interviewCard 上的"复制完整邀请文案"逻辑：组织名 + 时长 + 链接
  // 不再弹模态框、不再提供 iframe 内嵌选项
  const copyShareMessage = () => {
    if (!interview) return;
    const link = interview.readable_slug
      ? `${base_url}/call/${interview.readable_slug}`
      : (interview.url as string);
    const message = t("interview.shareMessageTemplate", {
      orgName: organization?.name ?? "",
      duration: interview.time_duration ?? "",
      link,
    });
    navigator.clipboard.writeText(message).then(
      () => {
        setShareCopied(true);
        toast.success(t("interview.infoCopied"), {
          position: "bottom-right",
          duration: 3000,
        });
        setTimeout(() => setShareCopied(false), 2000);
      },
      (err) => console.error("failed to copy", err?.message),
    );
  };

  const handleColorChange = (color: { hex: string }) => {
    setThemeColor(color.hex);
  };

  const applyColorChange = () => {
    if (themeColor !== iconColor) {
      seticonColor(themeColor);
      handleThemeColorChange(themeColor);
    }
    setShowColorPicker(false);
  };

  const filterResponses = () => {
    if (!responses) {
      return [];
    }
    if (filterStatus === "ALL") {
      return responses;
    }

    return responses?.filter((response) => response?.candidate_status === filterStatus);
  };

  return (
    <div className="flex flex-col w-full h-full m-2 bg-white">
      {loading ? (
        <div className="flex flex-col items-center justify-center h-[80%] w-full">
          <LoaderWithText />
        </div>
      ) : (
        <>
          <div className="flex flex-row p-3 pt-4 justify-center gap-6 items-center bg-white">
            <div className="font-bold text-md">{interview?.name}</div>

            <div
              className="w-5 h-5 rounded-full border-2 border-white shadow"
              style={{ backgroundColor: iconColor }}
            />

            <div className="flex flex-row gap-3 my-auto">
              <UserIcon className="my-auto" size={16} />: {String(responses?.length)}
            </div>

            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    className={`bg-transparent shadow-none relative text-xs px-1 h-7 hover:scale-110 hover:bg-transparent ${
                      shareCopied ? "text-green-600" : "text-indigo-600"
                    }`}
                    variant={"secondary"}
                    onClick={(event) => {
                      event.stopPropagation();
                      copyShareMessage();
                    }}
                  >
                    <Share2 size={16} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent className="bg-zinc-300" side="bottom" sideOffset={4}>
                  <span className="text-black flex flex-row gap-4">
                    {t("interview.shareInterviewLink")}
                  </span>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    className="bg-transparent shadow-none text-xs text-indigo-600 px-0 h-7 hover:scale-110 relative"
                    onClick={(event) => {
                      event.stopPropagation();
                      seeInterviewPreviewPage();
                    }}
                  >
                    <Eye />
                  </Button>
                </TooltipTrigger>
                <TooltipContent className="bg-zinc-300" side="bottom" sideOffset={4}>
                  <span className="text-black flex flex-row gap-4">{t("common.preview")}</span>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    className="bg-transparent shadow-none text-xs text-indigo-600 px-0 h-7 hover:scale-110 relative"
                    onClick={(event) => {
                      event.stopPropagation();
                      setShowColorPicker(!showColorPicker);
                    }}
                  >
                    <Palette size={19} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent className="bg-zinc-300" side="bottom" sideOffset={4}>
                  <span className="text-black flex flex-row gap-4">{t("themeColor.tooltip")}</span>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    className="bg-transparent shadow-none text-xs text-indigo-600 px-0 h-7 hover:scale-110 relative"
                    onClick={(event) => {
                      router.push(`/interviews/${resolvedParams.interviewId}?edit=true`);
                    }}
                  >
                    <Pencil size={16} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent className="bg-zinc-300" side="bottom" sideOffset={4}>
                  <span className="text-black flex flex-row gap-4">{t("common.edit")}</span>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <div className="inline-flex cursor-pointer">
              {currentPlan === "free_trial_over" ? (
                <>
                  <span className="ms-3 my-auto text-sm">{t("common.inactive")}</span>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipContent className="bg-zinc-300" side="bottom" sideOffset={4}>
                        {t("interview.upgradeToReactivate")}
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </>
              ) : (
                <>
                  <span className="ms-3 my-auto text-sm">{t("common.active")}</span>
                  <Switch
                    checked={isActive}
                    className={`ms-3 my-auto ${isActive ? "bg-indigo-600" : "bg-[#E6E7EB]"}`}
                    onCheckedChange={handleToggle}
                  />
                </>
              )}
            </div>
          </div>
          <div className="flex flex-row w-full p-2 h-[85%] gap-1 ">
            <div className="w-[20%] flex flex-col p-2 divide-y-2 rounded-sm border-2 border-slate-100">
              <div className="flex w-full justify-center py-2">
                <Select
                  onValueChange={async (newValue: string) => {
                    setFilterStatus(newValue);
                  }}
                >
                  <SelectTrigger className="w-[95%] bg-slate-100 rounded-lg">
                    <Filter size={18} className=" text-slate-400" />
                    <SelectValue placeholder={t("filter.filterBy")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={CandidateStatus.NO_STATUS}>
                      <div className="flex items-center">
                        <div className="w-3 h-3 bg-gray-400 rounded-full mr-2" />
                        {t("candidate.noStatus")}
                      </div>
                    </SelectItem>
                    <SelectItem value={CandidateStatus.NOT_SELECTED}>
                      <div className="flex items-center">
                        <div className="w-3 h-3 bg-red-500 rounded-full mr-2" />
                        {t("candidate.notSelected")}
                      </div>
                    </SelectItem>
                    <SelectItem value={CandidateStatus.POTENTIAL}>
                      <div className="flex items-center">
                        <div className="w-3 h-3 bg-yellow-500 rounded-full mr-2" />
                        {t("candidate.potential")}
                      </div>
                    </SelectItem>
                    <SelectItem value={CandidateStatus.SELECTED}>
                      <div className="flex items-center">
                        <div className="w-3 h-3 bg-green-500 rounded-full mr-2" />
                        {t("candidate.selected")}
                      </div>
                    </SelectItem>
                    <SelectItem value="ALL">
                      <div className="flex items-center">
                        <div className="w-3 h-3 border-2 border-gray-300 rounded-full mr-2" />
                        {t("common.all")}
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* 把 response 列表高度限制 1/2，给下面的视频播放器槽位让空间 */}
              <ScrollArea className="flex-1 min-h-[160px] max-h-[50%] p-1 rounded-md border-none">
                {filterResponses().length > 0 ? (
                  filterResponses().map((response) => {
                    // 合并模式下要标注 response 来自哪个面试（跨 a/b/c 区分用）；
                    // 自己面试的不标，免得冗余
                    const sourceInterviewName = (response as any).interview_name as string | undefined;
                    const isFromOtherInterview =
                      response.interview_id !== resolvedParams.interviewId;
                    return (
                    <button
                      type="button"
                      className={`p-2 rounded-md hover:bg-indigo-100 border-2 my-1 text-left text-xs ${
                        resolvedSearchParams.call === response.call_id
                          ? "bg-indigo-200"
                          : "border-indigo-100"
                      } flex flex-row justify-between cursor-pointer w-full`}
                      key={response?.id}
                      onClick={() => {
                        // 关键：导航到 response 自己所属的 interview，不是当前页 anchor
                        // 这样跨同岗位面试 a/b 切换时，URL 正确更新，详情区也是对应面试的 callInfo
                        router.push(
                          `/interviews/${response.interview_id}?call=${response.call_id}`,
                        );
                        handleResponseClick(response);
                      }}
                    >
                      <div className="flex flex-row gap-1 items-center w-full">
                        {response.candidate_status === "NOT_SELECTED" ? (
                          <div className="w-[5%] h-full bg-red-500 rounded-sm" />
                        ) : response.candidate_status === "POTENTIAL" ? (
                          <div className="w-[5%] h-full bg-yellow-500 rounded-sm" />
                        ) : response.candidate_status === "SELECTED" ? (
                          <div className="w-[5%] h-full bg-green-500 rounded-sm" />
                        ) : (
                          <div className="w-[5%] h-full bg-gray-400 rounded-sm" />
                        )}
                        <div className="flex items-center justify-between w-full">
                          <div className="flex flex-col my-auto">
                            <p className="font-medium mb-[2px]">
                              {response?.name ? `${response?.name}'s Response` : t("common.anonymous")}
                            </p>
                            <p className="">
                              {formatTimestampToDateHHMM(String(response?.created_at))}
                            </p>
                            {isFromOtherInterview && sourceInterviewName && (
                              <p className="mt-[2px] text-[10px] text-indigo-500 truncate max-w-[140px]">
                                {sourceInterviewName}
                              </p>
                            )}
                          </div>
                          <div className="flex flex-col items-center justify-center ml-auto flex-shrink-0">
                            {!response.is_viewed && (
                              <div className="w-4 h-4 flex items-center justify-center mb-1">
                                <div className="text-indigo-500 text-xl leading-none">●</div>
                              </div>
                            )}
                            <div
                              className={`w-6 h-6 flex items-center justify-center ${
                                response.is_viewed ? "h-full" : ""
                              }`}
                            >
                              {response.analytics &&
                                response.analytics.overallScore !== undefined && (
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <div className="w-6 h-6 rounded-full bg-white border-2 border-indigo-500 flex items-center justify-center">
                                          <span className="text-indigo-500 text-xs font-semibold">
                                            {response?.analytics?.overallScore}
                                          </span>
                                        </div>
                                      </TooltipTrigger>
                                      <TooltipContent
                                        className="bg-gray-500"
                                        side="bottom"
                                        sideOffset={4}
                                      >
                                        <span className="text-white font-normal flex flex-row gap-4">
                                          {t("summary.overallScore")}
                                        </span>
                                      </TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </button>
                    );
                  })
                ) : (
                  <p className="text-center text-gray-500">{t("dashboard.noResponses")}</p>
                )}
              </ScrollArea>

              {/* 视频播放器槽位 —— 跟随页面布局（不悬浮）。仅在选中某个 call 时显示。
                  - 没视频/未打开：浅色占位框（用户感受到这里有内容入口）
                  - 用户点"播放视频"按钮 → 下面真的挂上 video 自动开播
                  - 进度条上叠加 Q/A markers，点 marker 可跳转到对应问答 */}
              {resolvedSearchParams.call && (
                <div className="mt-3 mb-1">
                  <VideoPlayer
                    ref={videoPlayerRef}
                    src={videoData.videoUrl}
                    isOpen={isVideoOpen}
                    onOpen={() => onOpenVideo(0)}
                    durationMs={videoData.videoDurationMs}
                    initialSeekSeconds={initialSeekSec}
                    markers={videoMarkers}
                    activeMarkerIndex={
                      // markers 是 turns 过滤了 offsetMs=0 的子集，没法直接用 turn index
                      // 这里按 currentSec 自己再算一次
                      (() => {
                        if (videoMarkers.length === 0) return -1;
                        let idx = -1;
                        for (let i = 0; i < videoMarkers.length; i++) {
                          if (videoMarkers[i].offsetMs / 1000 <= currentVideoSec) idx = i;
                          else break;
                        }
                        return idx;
                      })()
                    }
                    onTimeUpdate={(s) => setCurrentVideoSec(s)}
                    onMarkerClick={(markerIdx) => {
                      // markers 是 turns.filter(t.offsetMs > 0) 的结果，
                      // 找回对应 turn index 调 onSeekToTurn
                      const m = videoMarkers[markerIdx];
                      if (!m) return;
                      const turnIdx = videoData.turns.findIndex(
                        (t) => t.offsetMs === m.offsetMs && t.role === m.role,
                      );
                      if (turnIdx >= 0) onSeekToTurn(turnIdx);
                    }}
                    onError={() => toast.error(t("response.videoLoadFailed"))}
                  />
                </div>
              )}
            </div>
            {responses && (
              <div className="w-[85%] rounded-md ">
                {resolvedSearchParams.call ? (
                  <CallInfo
                    call_id={resolvedSearchParams.call}
                    onDeleteResponse={handleDeleteResponse}
                    onCandidateStatusChange={handleCandidateStatusChange}
                    currentVideoSec={currentVideoSec}
                    videoOpen={isVideoOpen}
                    onVideoData={setVideoData}
                    onOpenVideo={onOpenVideo}
                    onSeekToTurn={onSeekToTurn}
                  />
                ) : resolvedSearchParams.edit ? (
                  <EditInterview interview={interview} />
                ) : (
                  <SummaryInfo responses={responses} interview={interview} />
                )}
              </div>
            )}
          </div>
        </>
      )}
      <Modal open={showColorPicker} closeOnOutsideClick={false} onClose={applyColorChange}>
        {/* react-color 的 ChromePicker 内部 Checkboard 用了浏览器才有的 API
            （URL.createObjectURL）+ EditableInput 用全局自增 ID，
            导致 SSR/CSR hydration mismatch。Modal 即使 open=false 也会挂载
            children，所以这里必须用 showColorPicker 显式 gate，
            首屏永远不挂载 ChromePicker，从源头消除 mismatch。 */}
        {showColorPicker && (
          <div className="w-[250px] p-3">
            <h3 className="text-lg font-semibold mb-4 text-center">{t("themeColor.chooseTitle")}</h3>
            <ChromePicker
              disableAlpha={true}
              color={themeColor}
              styles={{
                default: {
                  picker: { width: "100%" },
                },
              }}
              onChange={handleColorChange}
            />
          </div>
        )}
      </Modal>
    </div>
  );
}

export default InterviewHome;
