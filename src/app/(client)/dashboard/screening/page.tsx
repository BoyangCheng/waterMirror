"use client";

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
        <h2 className="mr-2 text-2xl font-semibold tracking-tight mt-8">
          {t("screening.title")}
        </h2>
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
          {/* 引导图：原图 1024×1024（正方形）。设 h-[400px] → 显示 400×400 */}
          <div className="hidden lg:block flex-shrink-0 mt-4">
            <Image
              src="/resume.png"
              alt="简历筛排引导"
              width={1024}
              height={1024}
              className="h-[400px] w-auto object-contain"
              priority
            />
          </div>
        </div>
      </div>
    </main>
  );
}

export default Screening;
