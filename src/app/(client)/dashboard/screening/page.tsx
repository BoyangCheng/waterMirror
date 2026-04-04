"use client";

import CreateJobCard from "@/components/dashboard/screening/createJobCard";
import JobCard from "@/components/dashboard/screening/jobCard";
import { useJobs } from "@/contexts/jobs.context";
import { useI18n } from "@/i18n";
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
        <div className="relative flex items-center mt-1 flex-wrap">
          <CreateJobCard />
          {jobsLoading ? (
            <JobsLoader />
          ) : (
            jobs.map((job) => <JobCard key={job.id} job={job} />)
          )}
        </div>
      </div>
    </main>
  );
}

export default Screening;
