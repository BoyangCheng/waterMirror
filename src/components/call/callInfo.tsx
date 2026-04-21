"use client";

import QuestionAnswerCard from "@/components/dashboard/interview/questionAnswerCard";
import LoaderWithText from "@/components/loaders/loader-with-text/loaderWithText";
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
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useI18n } from "@/i18n";
import { CandidateStatus } from "@/lib/enum";
import { getInterviewById } from "@/services/interviews.service";
import { getResponseByCallId, deleteResponse, updateResponse } from "@/services/responses.service";
import type { Analytics, CallData } from "@/types/response";
import { CircularProgress } from "@nextui-org/react";
import { ScrollArea } from "@radix-ui/react-scroll-area";
import axios from "axios";
import { DownloadIcon, FileTextIcon, TrashIcon } from "lucide-react";
import { ArrowLeft } from "lucide-react";
import { marked } from "marked";
import { useRouter } from "next/navigation";
import React, { useEffect, useRef, useState } from "react";
import ReactAudioPlayer from "react-audio-player";
import { toast } from "sonner";

type CallProps = {
  call_id: string;
  onDeleteResponse: (deletedCallId: string) => void;
  onCandidateStatusChange: (callId: string, newStatus: string) => void;
};

function CallInfo({ call_id, onDeleteResponse, onCandidateStatusChange }: CallProps) {
  const [call, setCall] = useState<CallData>();
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [email, setEmail] = useState<string>("");
  const [name, setName] = useState<string>("");
  const [isClicked, setIsClicked] = useState(false);
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [transcript, setTranscript] = useState("");
  const [candidateStatus, setCandidateStatus] = useState<string>("");
  const [interviewId, setInterviewId] = useState<string>("");
  const [interviewName, setInterviewName] = useState<string>("");
  const [tabSwitchCount, setTabSwitchCount] = useState<number>();
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
  const summaryRef = useRef<HTMLDivElement | null>(null);
  const questionSummaryRef = useRef<HTMLDivElement | null>(null);
  const { t } = useI18n();

  useEffect(() => {
    const fetchResponses = async () => {
      setIsLoading(true);
      setCall(undefined);
      setEmail("");
      setName("");

      try {
        const response = await axios.post("/api/get-call", { id: call_id });
        setCall(response.data.callResponse);
        setAnalytics(response.data.analytics);
      } catch (error) {
        console.error(error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchResponses();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [call_id]);

  useEffect(() => {
    const fetchEmail = async () => {
      setIsLoading(true);
      try {
        const response = await getResponseByCallId(call_id);
        if (!response) return;
        setEmail(response.email);
        setName(response.name ?? "");
        setCandidateStatus(response.candidate_status);
        setInterviewId(response.interview_id);
        setTabSwitchCount(response.tab_switch_count);
        // 取面试名称用于 PDF 标题
        if (response.interview_id) {
          getInterviewById(response.interview_id)
            .then((iv) => {
              if (iv?.name) setInterviewName(iv.name);
            })
            .catch(() => {});
        }
      } catch (error) {
        console.error(error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchEmail();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [call_id]);

  useEffect(() => {
    const replaceAgentAndUser = (transcript: string, name: string): string => {
      const agentReplacement = "**AI interviewer:**";
      const userReplacement = `**${name}:**`;

      // 先合并连续的 Agent: 行，避免同一句话被拆成多条
      const lines = transcript.split(/\r?\n/);
      const mergedLines: string[] = [];
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        if (trimmed.startsWith("Agent:") && mergedLines.length > 0) {
          const last = mergedLines[mergedLines.length - 1].trim();
          if (last.startsWith("Agent:")) {
            mergedLines[mergedLines.length - 1] += trimmed.slice("Agent:".length);
            continue;
          }
        }
        mergedLines.push(trimmed);
      }

      let updatedTranscript = mergedLines
        .join("\n")
        .replace(/Agent:/g, agentReplacement)
        .replace(/User:/g, userReplacement);

      // Add space between the dialogues
      updatedTranscript = updatedTranscript.replace(/(?:\r\n|\r|\n)/g, "\n\n");

      return updatedTranscript;
    };

    if (call && name) {
      setTranscript(replaceAgentAndUser(call?.transcript as string, name));
    }
  }, [call, name]);

  // 把面试总结导出成 PDF。
  // 用 html2canvas + jsPDF 的组合：浏览器原生渲染中文，再把渲染好的图像贴进 PDF，
  // 不依赖第三方字体文件，对国内常用浏览器字体（PingFang/微软雅黑等）天然兼容。
  // 只导出"总体概要 + 问题概要"，并在最上面加一行"面试名称 - 候选人姓名"标题。
  const onDownloadPdf = async () => {
    if (!summaryRef.current || isDownloadingPdf) return;
    setIsDownloadingPdf(true);

    // 临时注入一个 PDF 标题，截完图后再移除，不影响页面 UI
    const titleText = `${interviewName || t("response.generalSummary")} - ${name || t("summary.anonymous")}`;
    const headerEl = document.createElement("div");
    headerEl.style.cssText =
      "background:#ffffff;padding:16px 20px 8px 20px;font-size:18px;font-weight:700;color:#111827;border-bottom:1px solid #e5e7eb;margin-bottom:8px;";
    headerEl.textContent = titleText;
    summaryRef.current.prepend(headerEl);

    try {
      const [{ default: html2canvas }, jsPDFModule] = await Promise.all([
        import("html2canvas"),
        import("jspdf"),
      ]);
      const JsPDF = (jsPDFModule as any).jsPDF || (jsPDFModule as any).default;

      const renderSection = async (el: HTMLElement) => {
        return html2canvas(el, {
          scale: 2,
          useCORS: true,
          backgroundColor: "#ffffff",
          windowWidth: el.scrollWidth,
        });
      };

      const addCanvasToPdf = (pdf: any, canvas: HTMLCanvasElement, isFirst: boolean) => {
        const pageWidth = pdf.internal.pageSize.getWidth();
        const pageHeight = pdf.internal.pageSize.getHeight();
        const margin = 24;
        const usableW = pageWidth - margin * 2;
        const imgHeight = (canvas.height * usableW) / canvas.width;
        const imgData = canvas.toDataURL("image/png");

        if (!isFirst) pdf.addPage();

        let heightLeft = imgHeight;
        let position = margin;
        pdf.addImage(imgData, "PNG", margin, position, usableW, imgHeight);
        heightLeft -= pageHeight - margin * 2;

        while (heightLeft > 0) {
          pdf.addPage();
          position = margin - (imgHeight - heightLeft);
          pdf.addImage(imgData, "PNG", margin, position, usableW, imgHeight);
          heightLeft -= pageHeight - margin * 2;
        }
      };

      const pdf = new JsPDF({ orientation: "p", unit: "pt", format: "a4" });
      try { pdf.setProperties({ title: titleText }); } catch { /* ignore */ }

      // 第一页：总体概要
      const canvas1 = await renderSection(summaryRef.current!);
      addCanvasToPdf(pdf, canvas1, true);

      // 第二页起：问题概要（如有）
      if (questionSummaryRef.current) {
        const canvas2 = await renderSection(questionSummaryRef.current);
        addCanvasToPdf(pdf, canvas2, false);
      }

      const safeName = (name || "candidate").replace(/[^\w\u4e00-\u9fa5-]+/g, "_");
      pdf.save(`interview-summary-${safeName}-${call_id}.pdf`);
      toast.success(t("response.pdfDownloaded"));
    } catch (err) {
      console.error("PDF export failed:", err);
      toast.error(t("response.pdfFailed"));
    } finally {
      headerEl.remove();
      setIsDownloadingPdf(false);
    }
  };

  const onDeleteResponseClick = async () => {
    try {
      const response = await getResponseByCallId(call_id);

      if (response) {
        const interview_id = response.interview_id;

        await deleteResponse(call_id);

        router.push(`/interviews/${interview_id}`);

        onDeleteResponse(call_id);
      }

      toast.success(t("response.deleteSuccess"), {
        position: "bottom-right",

        duration: 3000,
      });
    } catch (error) {
      console.error("Error deleting response:", error);

      toast.error(t("response.deleteFailed"), {
        position: "bottom-right",

        duration: 3000,
      });
    }
  };

  return (
    <div className="h-screen z-[10] mx-2 mb-[100px] overflow-y-scroll">
      {isLoading ? (
        <div className="flex flex-col items-center justify-center h-[75%] w-full">
          <LoaderWithText />
        </div>
      ) : (
        <>
          <div className="bg-slate-200 rounded-2xl min-h-[120px] p-4 px-5 y-3">
            <div className="flex flex-col justify-between bt-2">
              <div>
                <div className="flex justify-between items-center pb-4 pr-2">
                  <button
                    type="button"
                    className="inline-flex items-center text-indigo-600 hover:cursor-pointer"
                    onClick={() => {
                      router.push(`/interviews/${interviewId}`);
                    }}
                  >
                    <ArrowLeft className="mr-2" />
                    <p className="text-sm font-semibold">{t("response.backToSummary")}</p>
                  </button>
                  {tabSwitchCount && tabSwitchCount > 0 && (
                    <p className="text-sm font-semibold text-red-500 bg-red-200 rounded-sm px-2 py-1">
                      {t("response.tabSwitchDetected")}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex flex-col justify-between gap-3 w-full">
                <div className="flex flex-row justify-between">
                  <div className="flex flex-row gap-3">
                    <Avatar>
                      <AvatarFallback>{name ? name[0] : "A"}</AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col">
                      {name && <p className="text-sm font-semibold px-2">{name}</p>}
                      {email && <p className="text-sm px-2">{email}</p>}
                    </div>
                  </div>
                  <div className="flex flex-row mr-2 items-center gap-3">
                    <Button
                      onClick={onDownloadPdf}
                      disabled={isDownloadingPdf}
                      className="bg-indigo-600 hover:bg-indigo-800 font-semibold"
                    >
                      <FileTextIcon size={16} className="mr-1" />
                      {isDownloadingPdf ? t("common.loading") : t("response.downloadPdf")}
                    </Button>
                    <Select
                      value={candidateStatus}
                      onValueChange={async (newValue: string) => {
                        setCandidateStatus(newValue);
                        await updateResponse(
                          { candidate_status: newValue },
                          call_id,
                        );
                        onCandidateStatusChange(call_id, newValue);
                      }}
                    >
                      <SelectTrigger className="w-[180px]  bg-slate-50 rounded-2xl">
                        <SelectValue placeholder={t("candidate.notSelected")} />
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
                      </SelectContent>
                    </Select>
                    <AlertDialog>
                      <AlertDialogTrigger>
                        <Button disabled={isClicked} className="bg-red-500 hover:bg-red-600 p-2">
                          <TrashIcon size={16} className="" />
                        </Button>
                      </AlertDialogTrigger>

                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>{t("common.areYouSure")}</AlertDialogTitle>

                          <AlertDialogDescription>
                            {t("response.deleteConfirm")}
                          </AlertDialogDescription>
                        </AlertDialogHeader>

                        <AlertDialogFooter>
                          <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>

                          <AlertDialogAction
                            className="bg-indigo-600 hover:bg-indigo-800 font-bold"
                            onClick={async () => {
                              await onDeleteResponseClick();
                            }}
                          >
                            {t("common.continue")}
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
                <div className="flex flex-col mt-3">
                  <p className="font-semibold">{t("response.interviewRecording")}</p>
                  <div className="flex flex-row gap-3 mt-2">
                    {call?.recording_url && <ReactAudioPlayer src={call?.recording_url} controls />}
                    <a
                      className="my-auto"
                      href={call?.recording_url}
                      download=""
                      aria-label="Download"
                    >
                      <DownloadIcon size={20} />
                    </a>
                  </div>
                </div>
              </div>
            </div>
            {/* <div>{call.}</div> */}
          </div>
          <div ref={summaryRef}>
          <div className="bg-slate-200 rounded-2xl min-h-[120px] p-4 px-5 my-3" id="general-summary-section">
            <p className="font-semibold my-2">{t("response.generalSummary")}</p>

            <div className="grid grid-cols-3 gap-4 my-2 mt-4 ">
              {analytics?.overallScore !== undefined && (
                <div className="flex flex-col gap-3 text-sm p-4 rounded-2xl bg-slate-50">
                  <div className="flex flex-row gap-2 align-middle">
                    <CircularProgress
                      classNames={{
                        svg: "w-28 h-28 drop-shadow-md",
                        indicator: "stroke-indigo-600",
                        track: "stroke-indigo-600/10",
                        value: "text-3xl font-semibold text-indigo-600",
                      }}
                      value={analytics?.overallScore}
                      strokeWidth={4}
                      showValueLabel={true}
                      formatOptions={{ signDisplay: "never" }}
                    />
                    <p className="font-medium my-auto text-xl">{t("response.overallHiringScore")}</p>
                  </div>
                  <div className="">
                    <div className="font-medium ">
                      <span className="font-normal">{t("response.feedback")} </span>
                      {analytics?.overallFeedback === undefined ? (
                        <Skeleton className="w-[200px] h-[20px]" />
                      ) : (
                        analytics?.overallFeedback
                      )}
                    </div>
                  </div>
                </div>
              )}
              {analytics?.communication && (
                <div className="flex flex-col gap-3 text-sm p-4 rounded-2xl bg-slate-50">
                  <div className="flex flex-row gap-2 align-middle">
                    <CircularProgress
                      classNames={{
                        svg: "w-28 h-28 drop-shadow-md",
                        indicator: "stroke-indigo-600",
                        track: "stroke-indigo-600/10",
                        value: "text-3xl font-semibold text-indigo-600",
                      }}
                      value={analytics?.communication.score}
                      maxValue={10}
                      minValue={0}
                      strokeWidth={4}
                      showValueLabel={true}
                      valueLabel={
                        <div className="flex items-baseline">
                          {analytics?.communication.score ?? 0}
                          <span className="text-xl ml-0.5">/10</span>
                        </div>
                      }
                      formatOptions={{ signDisplay: "never" }}
                    />
                    <p className="font-medium my-auto text-xl">{t("response.communication")}</p>
                  </div>
                  <div className="">
                    <div className="font-medium ">
                      <span className="font-normal">{t("response.feedback")} </span>
                      {analytics?.communication.feedback === undefined ? (
                        <Skeleton className="w-[200px] h-[20px]" />
                      ) : (
                        analytics?.communication.feedback
                      )}
                    </div>
                  </div>
                </div>
              )}
              <div className="flex flex-col gap-3 text-sm p-4 rounded-2xl bg-slate-50">
                <div className="flex flex-row gap-2  align-middle">
                  <p className="my-auto">{t("response.userSentiment")} </p>
                  <p className="font-medium my-auto">
                    {analytics?.jobTendency === undefined ? (
                      <Skeleton className="w-[200px] h-[20px]" />
                    ) : analytics.jobTendency === "positive" ? (
                      t("summary.positive")
                    ) : analytics.jobTendency === "optimistic" ? (
                      t("summary.optimistic")
                    ) : analytics.jobTendency === "negative" ? (
                      t("summary.negative")
                    ) : (
                      "-"
                    )}
                  </p>

                  <div
                    className={`${
                      analytics?.jobTendency === "optimistic"
                        ? "text-blue-500"
                        : analytics?.jobTendency === "negative"
                          ? "text-red-500"
                          : analytics?.jobTendency === "positive"
                            ? "text-green-500"
                            : "text-transparent"
                    } text-xl`}
                  >
                    ●
                  </div>
                </div>
                <div className="">
                  <div className="font-medium  ">
                    <span className="font-normal">{t("response.callSummary")} </span>
                    {analytics === null || analytics === undefined ? (
                      <Skeleton className="w-[200px] h-[20px]" />
                    ) : (
                      analytics.callSummary ||
                      analytics.softSkillSummary ||
                      call?.call_analysis?.call_summary ||
                      t("summary.noSummary")
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
          </div>
          {analytics?.questionSummaries && analytics.questionSummaries.length > 0 && (
            <div ref={questionSummaryRef} className="bg-slate-200 rounded-2xl min-h-[120px] p-4 px-5 my-3">
              <p className="font-semibold my-2 mb-4">{t("response.questionSummary")}</p>
              <div className="text-sm mt-3 py-3 leading-6 whitespace-pre-line px-2">
                {analytics?.questionSummaries.map((qs, index) => (
                  <QuestionAnswerCard
                    key={qs.question}
                    questionNumber={index + 1}
                    question={qs.question}
                    answer={qs.summary}
                  />
                ))}
              </div>
            </div>
          )}
          <div className="bg-slate-200 rounded-2xl min-h-[150px] max-h-[500px] p-4 px-5 mb-[150px]">
            <p className="font-semibold my-2 mb-4">{t("response.transcript")}</p>
            <ScrollArea className="rounded-2xl text-sm h-96  overflow-y-auto whitespace-pre-line px-2">
              <div
                className="text-sm p-4 rounded-2xl leading-5 bg-slate-50"
                // biome-ignore lint/security/noDangerouslySetInnerHtml: required for markdown rendering
                dangerouslySetInnerHTML={{ __html: marked(transcript) }}
              />
            </ScrollArea>
          </div>
        </>
      )}
    </div>
  );
}

export default CallInfo;
