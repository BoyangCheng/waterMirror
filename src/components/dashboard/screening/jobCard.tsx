"use client";

import { Card, CardContent, CardTitle } from "@/components/ui/card";
import { useI18n } from "@/i18n";
import type { Job } from "@/types/job";
import { Loader2, CheckCircle2 } from "lucide-react";
import { useRouter } from "next/navigation";
import React from "react";

interface Props {
  job: Job;
}

function JobCard({ job }: Props) {
  const router = useRouter();
  const { t } = useI18n();

  return (
    <Card
      className="flex items-center cursor-pointer hover:scale-105 ease-in-out duration-300 h-60 w-56 ml-1 mr-3 mt-4 rounded-xl shrink-0 overflow-hidden shadow-md border border-gray-200"
      onClick={() => router.push(`/dashboard/screening/${job.id}`)}
    >
      <CardContent className="flex items-center flex-col mx-auto px-4 py-6">
        <div className="flex flex-col justify-center items-center w-full">
          <CardTitle className="p-0 text-md text-center line-clamp-2">
            {job.name}
          </CardTitle>
          <p className="text-xs text-gray-400 mt-2">
            {new Date(job.created_at).toLocaleDateString()}
          </p>
        </div>
        <div className="mt-4 flex items-center">
          {job.status === "processing" ? (
            <div className="flex items-center text-amber-500">
              <Loader2 size={16} className="animate-spin mr-1" />
              <span className="text-xs">{t("screening.processing")}</span>
            </div>
          ) : (
            <div className="flex items-center text-green-600">
              <CheckCircle2 size={16} className="mr-1" />
              <span className="text-xs">{t("screening.completed")}</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default JobCard;
