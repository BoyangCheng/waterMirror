"use client";

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
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import { useJobs } from "@/contexts/jobs.context";
import { useI18n } from "@/i18n";
import type { Job } from "@/types/job";
import { Loader2, CheckCircle2, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import React from "react";

interface Props {
  job: Job;
}

function JobCard({ job }: Props) {
  const router = useRouter();
  const { t } = useI18n();
  const { deleteJob } = useJobs();

  return (
    <div className="relative inline-block ml-1 mr-3 mt-4">
      <Card
        className="flex items-center cursor-pointer hover:scale-105 ease-in-out duration-300 h-60 w-56 rounded-xl shrink-0 overflow-hidden shadow-md border border-gray-200"
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
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button
            className="absolute top-2 right-2 h-6 w-6 p-0 text-red-400 bg-white/80 hover:bg-white hover:text-red-600"
            variant="secondary"
            onClick={(e) => e.stopPropagation()}
          >
            <Trash2 size={13} />
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("common.areYouSure")}</AlertDialogTitle>
            <AlertDialogDescription>{t("screening.deleteConfirm")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteJob(job.id)}>
              {t("common.continue")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default JobCard;
