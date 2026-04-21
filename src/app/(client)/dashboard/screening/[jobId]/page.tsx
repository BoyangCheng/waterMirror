"use client";

import Modal from "@/components/dashboard/Modal";
import ResumeUpload from "@/components/dashboard/screening/resumeUpload";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/i18n";
import type { Interviewee, Job } from "@/types/job";
import axios from "axios";
import {
  ArrowLeft,
  CheckCircle2,
  ExternalLink,
  Loader2,
  Plus,
} from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

function JobDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { t } = useI18n();
  const jobId = params.jobId as string;

  const [job, setJob] = useState<Job | null>(null);
  const [interviewees, setInterviewees] = useState<Interviewee[]>([]);
  const [loading, setLoading] = useState(true);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  const fetchJobDetail = useCallback(async () => {
    try {
      const res = await axios.get(`/api/screening/job/${jobId}`);
      setJob(res.data.job);
      setInterviewees(res.data.interviewees);
    } catch (error) {
      console.error(error);
    }
    setLoading(false);
  }, [jobId]);

  useEffect(() => {
    fetchJobDetail();
  }, [fetchJobDetail]);

  // Poll when processing
  useEffect(() => {
    const hasProcessing =
      job?.status === "processing" ||
      interviewees.some((i) => i.status === "pending");

    if (hasProcessing) {
      pollingRef.current = setInterval(() => {
        fetchJobDetail();
      }, 5000);
    }

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [job?.status, interviewees, fetchJobDetail]);

  const onAddResumes = async () => {
    if (files.length === 0) return;
    setIsSubmitting(true);

    try {
      const formData = new FormData();
      formData.append("job_id", jobId);
      for (const file of files) {
        formData.append("files", file);
      }

      await axios.post("/api/screening/add-resumes", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      toast.success(t("screening.addResumeSuccess"), {
        position: "bottom-right",
        duration: 3000,
      });

      setAddModalOpen(false);
      setFiles([]);
      fetchJobDetail();
    } catch (error) {
      console.error(error);
      toast.error(t("screening.addResumeFailed"), {
        position: "bottom-right",
        duration: 3000,
      });
    }
    setIsSubmitting(false);
  };

  if (loading) {
    return (
      <main className="p-8 pt-0 ml-12 mr-auto">
        <div className="mt-8 space-y-4">
          <div className="h-8 w-64 animate-pulse rounded bg-gray-300" />
          <div className="h-4 w-96 animate-pulse rounded bg-gray-300" />
          <div className="h-64 w-full animate-pulse rounded bg-gray-300" />
        </div>
      </main>
    );
  }

  if (!job) {
    return (
      <main className="p-8 pt-0 ml-12 mr-auto">
        <div className="mt-8">
          <p className="text-gray-500">Job not found</p>
        </div>
      </main>
    );
  }

  return (
    <main className="p-8 pt-0 ml-12 mr-auto">
      {/* Header */}
      <div className="flex items-center justify-between mt-8">
        <div className="flex items-center gap-4">
          <button
            type="button"
            className="p-2 hover:bg-gray-100 rounded-md cursor-pointer"
            onClick={() => router.push("/dashboard/screening")}
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h2 className="text-2xl font-semibold">{job.name}</h2>
            <div className="flex items-center gap-2 mt-1">
              {job.status === "processing" ? (
                <div className="flex items-center text-amber-500">
                  <Loader2 size={14} className="animate-spin mr-1" />
                  <span className="text-xs">{t("screening.processing")}</span>
                </div>
              ) : (
                <div className="flex items-center text-green-600">
                  <CheckCircle2 size={14} className="mr-1" />
                  <span className="text-xs">{t("screening.completed")}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Job Description */}
      <div className="mt-4 p-4 bg-gray-50 rounded-lg">
        <h3 className="text-sm font-medium text-gray-700">
          {t("screening.jobDesc")}
        </h3>
        <p className="text-sm text-gray-600 mt-1 whitespace-pre-wrap">
          {job.description}
        </p>
      </div>

      {/* Add More Resumes Button */}
      <div className="mt-4">
        <Button
          className="bg-indigo-600 hover:bg-indigo-800 font-bold"
          onClick={() => {
            setFiles([]);
            setAddModalOpen(true);
          }}
        >
          <Plus size={16} className="mr-1" />
          {t("screening.addMore")}
        </Button>
      </div>

      {/* Interviewees Table */}
      <div className="mt-6 overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-gray-100 text-left">
              <th className="px-4 py-3 text-sm font-medium text-gray-600 w-12">
                {t("screening.rank")}
              </th>
              <th className="px-4 py-3 text-sm font-medium text-gray-600">
                {t("screening.candidateName")}
              </th>
              <th className="px-4 py-3 text-sm font-medium text-gray-600 w-28">
                {t("screening.company")}
              </th>
              <th className="px-4 py-3 text-sm font-medium text-gray-600 w-28">
                {t("screening.position")}
              </th>
              <th className="px-4 py-3 text-sm font-medium text-gray-600">
                {t("screening.phone")}
              </th>
              <th className="px-4 py-3 text-sm font-medium text-gray-600 min-w-[28rem]">
                {t("screening.highlightSummary")}
              </th>
              <th className="px-4 py-3 text-sm font-medium text-gray-600 w-16 text-center">
                {t("screening.score")}
              </th>
              <th className="px-4 py-3 text-sm font-medium text-gray-600 w-16 text-center">
                {t("screening.resume")}
              </th>
            </tr>
          </thead>
          <tbody>
            {interviewees.map((interviewee, index) => (
              <tr
                key={interviewee.id}
                className={`border-b border-gray-100 hover:bg-gray-50 ${
                  interviewee.status === "pending" ? "opacity-50" : ""
                }`}
              >
                <td className="px-4 py-3 text-sm text-gray-800 text-center">
                  {interviewee.status === "pending" ? (
                    <Loader2 size={14} className="animate-spin mx-auto" />
                  ) : (
                    index + 1
                  )}
                </td>
                <td className="px-4 py-3 text-sm font-medium text-gray-800">
                  {interviewee.status === "pending" ? (
                    <div className="h-4 w-16 animate-pulse rounded bg-gray-200" />
                  ) : (
                    interviewee.name || "-"
                  )}
                </td>
                <td className="px-4 py-3 text-sm text-gray-600 w-28">
                  {interviewee.status === "pending" ? (
                    <div className="h-4 w-20 animate-pulse rounded bg-gray-200" />
                  ) : (
                    <span className="line-clamp-2 break-words">{interviewee.company || "-"}</span>
                  )}
                </td>
                <td className="px-4 py-3 text-sm text-gray-600 w-28">
                  {interviewee.status === "pending" ? (
                    <div className="h-4 w-24 animate-pulse rounded bg-gray-200" />
                  ) : (
                    <span className="line-clamp-2 break-words">{interviewee.position || "-"}</span>
                  )}
                </td>
                <td className="px-4 py-3 text-sm text-gray-600">
                  {interviewee.status === "pending" ? (
                    <div className="h-4 w-24 animate-pulse rounded bg-gray-200" />
                  ) : (
                    interviewee.phone || "-"
                  )}
                </td>
                <td className="px-4 py-3 text-sm text-gray-600 min-w-[28rem]">
                  {interviewee.status === "pending" ? (
                    <div className="h-4 w-40 animate-pulse rounded bg-gray-200" />
                  ) : (
                    <span className="line-clamp-3">
                      {interviewee.summary || "-"}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-center">
                  {interviewee.status === "pending" ? (
                    <div className="h-4 w-8 mx-auto animate-pulse rounded bg-gray-200" />
                  ) : (
                    <span
                      className={`text-sm font-semibold ${
                        interviewee.score >= 80
                          ? "text-green-600"
                          : interviewee.score >= 60
                            ? "text-amber-500"
                            : "text-red-500"
                      }`}
                    >
                      {interviewee.score}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-center">
                  {interviewee.resume_url && (
                    <a
                      href={interviewee.resume_url.replace(/^http:\/\//, "https://")}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-indigo-600 hover:text-indigo-800 inline-flex items-center"
                      title={interviewee.original_filename || t("screening.viewResume")}
                    >
                      <ExternalLink size={16} />
                    </a>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {interviewees.length === 0 && (
          <div className="text-center py-12 text-gray-400">
            {t("screening.noJobs")}
          </div>
        )}
      </div>

      {/* Add Resumes Modal */}
      <Modal
        open={addModalOpen}
        closeOnOutsideClick={false}
        onClose={() => setAddModalOpen(false)}
      >
        <div className="text-center w-[30rem]">
          <h1 className="text-xl font-semibold">{t("screening.addMore")}</h1>
          <div className="mt-4 px-6">
            <ResumeUpload files={files} setFiles={setFiles} />
            <div className="mt-6 mb-2">
              <Button
                disabled={files.length === 0 || isSubmitting}
                className="bg-indigo-600 hover:bg-indigo-800 w-48 text-lg font-bold"
                onClick={onAddResumes}
              >
                {isSubmitting ? t("common.loading") : t("screening.goWork")}
              </Button>
            </div>
          </div>
        </div>
      </Modal>
    </main>
  );
}

export default JobDetailPage;
