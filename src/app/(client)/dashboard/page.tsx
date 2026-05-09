"use client";

import Modal from "@/components/dashboard/Modal";
import CreateInterviewCard from "@/components/dashboard/interview/createInterviewCard";
import InterviewCard from "@/components/dashboard/interview/interviewCard";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import { useInterviews } from "@/contexts/interviews.context";
import { useJobs } from "@/contexts/jobs.context";
import { useI18n } from "@/i18n";
import { useOrg } from "@/contexts/auth.context";
import { useOrganizationQuery, useResponseCountQuery } from "@/hooks/useOrganizationQuery";
import { updateOrganization } from "@/services/clients.service";
import { deactivateInterviewsByOrgId } from "@/services/interviews.service";
import { groupInterviewsByJob } from "@/lib/interview-grouping";
import { queryKeys } from "@/lib/query-keys";
import type { Interview } from "@/types/interview";
import { Gem, Plus } from "lucide-react";
import Image from "next/image";
import React, { useState, useEffect, useMemo, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";

function Interviews() {
  const { interviews, interviewsLoading } = useInterviews();
  const { jobs } = useJobs();
  const { organization } = useOrg();
  const orgId = organization?.id;
  const { t } = useI18n();
  const qc = useQueryClient();

  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  // 防止超额停用逻辑重复触发
  const deactivatingRef = useRef(false);

  // ── 1. 获取组织信息（plan、allowed_responses_count）──────────────────────
  const { data: orgData } = useOrganizationQuery(orgId);
  const currentPlan = orgData?.plan ?? "";
  const allowedResponsesCount = orgData?.allowed_responses_count ?? 10;

  // ── 2. 仅当 plan==='free' 时查询已使用回复数 ─────────────────────────────
  const { data: totalResponses } = useResponseCountQuery(
    orgId,
    currentPlan === "free",
  );

  // ── 3. 触发升级弹窗 ───────────────────────────────────────────────────────
  useEffect(() => {
    if (currentPlan === "free_trial_over") {
      setIsModalOpen(true);
    }
  }, [currentPlan]);

  // ── 4. 超额处理：停用面试 + 更新 plan（只执行一次）────────────────────────
  useEffect(() => {
    if (
      !orgId ||
      currentPlan !== "free" ||
      totalResponses === undefined ||
      totalResponses < allowedResponsesCount ||
      deactivatingRef.current
    ) {
      return;
    }
    deactivatingRef.current = true;
    Promise.all([
      deactivateInterviewsByOrgId(orgId),
      updateOrganization({ plan: "free_trial_over" }, orgId),
    ]).then(() => {
      // 使组织信息缓存失效，下次自动重新拉取最新 plan
      qc.invalidateQueries({ queryKey: queryKeys.organization.detail(orgId) });
    });
  }, [orgId, currentPlan, totalResponses, allowedResponsesCount, qc]);

  function InterviewsLoader() {
    return (
      <div className="flex flex-row">
        <div className="h-60 w-56 ml-1 mr-3 mt-3 flex-none animate-pulse rounded-xl bg-gray-300" />
        <div className="h-60 w-56 ml-1 mr-3 mt-3 flex-none animate-pulse rounded-xl bg-gray-300" />
        <div className="h-60 w-56 ml-1 mr-3 mt-3 flex-none animate-pulse rounded-xl bg-gray-300" />
      </div>
    );
  }

  // 按 job 分组（纯逻辑抽到 src/lib/interview-grouping，便于单测）
  const grouped = useMemo(
    () => groupInterviewsByJob<Interview>(interviews, jobs, t("dashboard.otherInterviews")),
    [interviews, jobs, t],
  );

  return (
    <main className="p-8 pt-0 ml-12 mr-auto rounded-md">
      <div className="flex flex-col items-left">
        <h2 className="mr-2 text-2xl font-semibold tracking-tight mt-8">
          {t("dashboard.myInterviews")}
        </h2>
        <h3 className="text-sm tracking-tight text-gray-600 font-medium">
          {t("dashboard.startGettingResponses")}
        </h3>
        {/* 第 1 行：创建面试 卡片单独占一行（按用户要求） */}
        <div className="flex items-center mt-1">
          {currentPlan === "free_trial_over" ? (
            <Card className="flex bg-gray-200 items-center border-dashed border-gray-700 border-2 hover:scale-105 ease-in-out duration-300 h-60 w-56 ml-1 mr-3 mt-4 rounded-xl shrink-0 overflow-hidden shadow-md">
              <CardContent className="flex items-center flex-col mx-auto">
                <div className="flex flex-col justify-center items-center w-full overflow-hidden">
                  <Plus size={90} strokeWidth={0.5} className="text-gray-700" />
                </div>
                <CardTitle className="p-0 text-md text-center">
                  {t("dashboard.cannotCreateMore")}
                </CardTitle>
              </CardContent>
            </Card>
          ) : (
            <CreateInterviewCard />
          )}
        </div>

        {/* 升级弹窗（仅 plan 触发，与列表渲染解耦） */}
        {isModalOpen && (
          <Modal open={isModalOpen} onClose={() => setIsModalOpen(false)}>
            <div className="flex flex-col space-y-4">
              <div className="flex justify-center text-indigo-600">
                <Gem />
              </div>
              <h3 className="text-xl font-semibold text-center">
                {t("dashboard.upgradeToPro")}
              </h3>
              <p className="text-l text-center">
                {t("dashboard.upgradeLimitMessage")}
              </p>
              <div className="grid grid-cols-2 gap-2">
                <div className="flex justify-center items-center">
                  <Image src={"/premium-plan-icon.png"} alt="Graphic" width={299} height={300} />
                </div>
                <div className="grid grid-rows-2 gap-2">
                  <div className="p-4 border rounded-lg">
                    <h4 className="text-lg font-medium">{t("dashboard.freePlan")}</h4>
                    <ul className="list-disc pl-5 mt-2">
                      <li>{t("dashboard.tenResponses")}</li>
                      <li>{t("dashboard.basicSupport")}</li>
                      <li>{t("dashboard.limitedFeatures")}</li>
                    </ul>
                  </div>
                  <div className="p-4 border rounded-lg">
                    <h4 className="text-lg font-medium">{t("dashboard.proPlan")}</h4>
                    <ul className="list-disc pl-5 mt-2">
                      <li>{t("dashboard.flexiblePay")}</li>
                      <li>{t("dashboard.prioritySupport")}</li>
                      <li>{t("dashboard.allFeatures")}</li>
                    </ul>
                  </div>
                </div>
              </div>
              <p className="text-l text-center">{t("dashboard.contactUpgrade")}</p>
            </div>
          </Modal>
        )}

        {/* 第 2 行起：按 job 分组，每组一行；overflow-x-auto 让超出的卡片可横向滚动 */}
        {interviewsLoading ? (
          <InterviewsLoader />
        ) : (
          <div className="mt-4 flex flex-col gap-4">
            {grouped.length === 0 ? (
              <p className="text-sm text-gray-500 ml-2 mt-2">
                {t("dashboard.noResponses")}
              </p>
            ) : (
              grouped.map((group) => (
                <div key={group.jobId ?? "__other__"} className="w-full">
                  <h3 className="text-sm font-semibold text-gray-700 mb-1 ml-1">
                    {group.jobName}
                    <span className="ml-2 text-xs font-normal text-gray-400">
                      ({group.items.length})
                    </span>
                  </h3>
                  <div className="flex flex-row overflow-x-auto pb-2 scrollbar-hide">
                    {group.items.map((item) => (
                      <InterviewCard
                        id={item.id}
                        interviewerId={item.interviewer_id}
                        key={item.id}
                        name={item.name}
                        url={item.url ?? ""}
                        readableSlug={item.readable_slug}
                        responseCount={Number(item.response_count ?? 0)}
                        timeDuration={item.time_duration ?? ""}
                      />
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </main>
  );
}

export default Interviews;
