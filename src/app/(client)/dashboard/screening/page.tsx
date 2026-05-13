"use client";

import { InsightTicker } from "@/components/dashboard/InsightTicker";
import CreateJobCard from "@/components/dashboard/screening/createJobCard";
import JobCard from "@/components/dashboard/screening/jobCard";
import { useJobs } from "@/contexts/jobs.context";
import { useI18n } from "@/i18n";
import Image from "next/image";
import React from "react";

function Screening() {
  const { jobs, jobsLoading } = useJobs();
  const { t } = useI18n();
  // 轮询逻辑已迁移至 useJobsQuery 的 refetchInterval，此处无需手动管理

  function JobsLoader() {
    return (
      <div className="flex flex-row">
        <div className="h-60 w-56 ml-1 mr-3 mt-3 flex-none animate-pulse rounded-xl bg-gray-300" />
        <div className="h-60 w-56 ml-1 mr-3 mt-3 flex-none animate-pulse rounded-xl bg-gray-300" />
        <div className="h-60 w-56 ml-1 mr-3 mt-3 flex-none animate-pulse rounded-xl bg-gray-300" />
      </div>
    );
  }

  return (
    <main className="p-8 pt-0 ml-12 mr-auto rounded-md">
      <div className="flex flex-col items-left">
        {/* 标题在左，ticker 在 main 区水平居中（视觉对齐 navbar 中央搜索） */}
        <div className="relative flex flex-row flex-wrap items-center gap-4 mt-8">
          <h2 className="text-2xl font-semibold tracking-tight">
            {t("screening.title")}
          </h2>
          <div className="md:absolute md:left-1/2 md:-translate-x-1/2">
            <InsightTicker />
          </div>
        </div>
        <h3 className="text-sm tracking-tight text-gray-600 font-medium">
          {t("screening.subtitle")}
        </h3>
        {/* 两栏布局：左侧 job 卡片网格（限宽留位），右侧引导图 */}
        <div className="flex flex-row items-start gap-6 mt-1">
          {/* job 网格：限制最大 4 列宽度（每张卡 ~14rem + gap），留右侧空间给图 */}
          <div className="relative flex items-center flex-wrap max-w-[60rem]">
            <CreateJobCard />
            {jobsLoading ? (
              <JobsLoader />
            ) : (
              jobs.map((job) => <JobCard key={job.id} job={job} />)
            )}
          </div>
          {/* 引导图：原图 908×767（约 1.18:1 横图，新尺寸）。
              h-[400px] → h-[480px]（放大 20%）→ 显示约 568×480，字体看起来比之前大 ~20% */}
          <div className="hidden lg:block flex-shrink-0 mt-4">
            <Image
              src="/resume.png"
              alt="简历筛排引导"
              width={908}
              height={767}
              className="h-[480px] w-auto object-contain"
              priority
            />
          </div>
        </div>
      </div>
    </main>
  );
}

export default Screening;
