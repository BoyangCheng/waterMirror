"use client";

import { InsightTicker } from "@/components/dashboard/InsightTicker";
import CreateInterviewerButton from "@/components/dashboard/interviewer/createInterviewerButton";
import InterviewerCard from "@/components/dashboard/interviewer/interviewerCard";
import { useInterviewers } from "@/contexts/interviewers.context";
import { useI18n } from "@/i18n";
import { ChevronLeft } from "lucide-react";
import { ChevronRight } from "lucide-react";
import Image from "next/image";
import React from "react";

function Interviewers() {
  const { interviewers, interviewersLoading } = useInterviewers();
  const { t } = useI18n();

  const slideLeft = () => {
    const slider = document.getElementById("slider");
    if (slider) {
      slider.scrollLeft = slider.scrollLeft - 190;
    }
  };

  const slideRight = () => {
    const slider = document.getElementById("slider");
    if (slider) {
      slider.scrollLeft = slider.scrollLeft + 190;
    }
  };

  function InterviewersLoader() {
    return (
      <>
        <div className="flex">
          <div className="h-40 w-36 ml-1 mr-3 flex-none animate-pulse rounded-xl bg-gray-300" />
          <div className="h-40 w-36 ml-1 mr-3 flex-none animate-pulse rounded-xl bg-gray-300" />
          <div className="h-40 w-36 ml-1 mr-3 flex-none animate-pulse rounded-xl bg-gray-300" />
        </div>
      </>
    );
  }

  return (
    <main className="p-8 pt-0 ml-12 mr-auto rounded-md">
      <div className="flex flex-col items-left">
        {/* 标题在左，ticker 在 main 区水平居中（视觉对齐 navbar 中央搜索）
            relative wrapper 必须直接挂在 main 全宽位置上,absolute 才能用 main 中心定位
            （之前嵌套在 flex-row 里时 wrapper 被挤窄,absolute 跑到 h2 旁边） */}
        <div className="relative flex flex-row flex-wrap items-center gap-4 mt-8">
          <h2 className="text-2xl font-semibold tracking-tight">{t("nav.interviewers")}</h2>
          {/* ticker 对齐 navbar 中央搜索:viewport 中心 = main 中心 - 120px (sidebar 240/2) */}
          <div className="md:absolute md:left-[calc(50%-120px)] md:-translate-x-1/2">
            <InsightTicker />
          </div>
        </div>
        <h3 className=" text-sm tracking-tight text-gray-600 font-medium ">
          {t("interviewerSettings.getToKnow")}
        </h3>
        <div className="relative flex items-center mt-2 ">
          <div
            id="slider"
            className=" h-44 pt-2 overflow-x-scroll scroll whitespace-nowrap scroll-smooth scrollbar-hide w-[40rem]"
          >
            {!interviewersLoading ? (
              <>
                <CreateInterviewerButton />
                {interviewers.map((interviewer) => (
                  <InterviewerCard key={interviewer.id} interviewer={interviewer} />
                ))}
              </>
            ) : (
              <InterviewersLoader />
            )}
          </div>
          {interviewers.length >= 4 ? (
            <div className="flex-row justify-center items-center space-y-10">
              <ChevronRight
                className="opacity-50 cursor-pointer hover:opacity-100"
                size={40}
                onClick={slideRight}
              />
              <ChevronLeft
                className="opacity-50 cursor-pointer hover:opacity-100"
                size={40}
                onClick={() => slideLeft()}
              />
            </div>
          ) : (
            <></>
          )}
        </div>
        {/* 引导图：原图 1670×2162（竖图）。固定 400px 高，宽自适应 ≈ 309 */}
        <div className="mt-4 ml-1">
          <Image
            src="/interviewerdirction.png"
            alt="面试官引导"
            width={1670}
            height={2162}
            className="h-[400px] w-auto object-contain"
            priority
          />
        </div>
      </div>
    </main>
  );
}

export default Interviewers;
