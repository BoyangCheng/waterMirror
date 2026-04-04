"use client";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useAuth, useOrg } from "@/contexts/auth.context";
import { useJobs } from "@/contexts/jobs.context";
import { useI18n } from "@/i18n";
import axios from "axios";
import React, { useState, useEffect } from "react";
import { toast } from "sonner";
import ResumeUpload from "./resumeUpload";

interface Props {
  open: boolean;
  setOpen: (open: boolean) => void;
}

function CreateJobModal({ open, setOpen }: Props) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { user } = useAuth();
  const { organization } = useOrg();
  const { fetchJobs } = useJobs();
  const { t } = useI18n();

  useEffect(() => {
    if (!open) {
      setName("");
      setDescription("");
      setFiles([]);
      setIsSubmitting(false);
    }
  }, [open]);

  const onSubmit = async () => {
    if (!name.trim() || !description.trim() || files.length === 0) {
      return;
    }

    setIsSubmitting(true);

    try {
      const formData = new FormData();
      formData.append("name", name.trim());
      formData.append("description", description.trim());
      formData.append("organization_id", organization?.id || "");
      formData.append("user_id", user?.id || "");

      for (const file of files) {
        formData.append("files", file);
      }

      await axios.post("/api/screening/create-job", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      toast.success(t("screening.createSuccess"), {
        position: "bottom-right",
        duration: 3000,
      });

      // Close modal and refresh jobs list
      setOpen(false);
      fetchJobs();
    } catch (error) {
      console.error(error);
      toast.error(t("screening.createFailed"), {
        position: "bottom-right",
        duration: 3000,
      });
      setIsSubmitting(false);
    }
  };

  return (
    <div className="text-center w-[38rem]">
      <h1 className="text-xl font-semibold">{t("screening.createJob")}</h1>
      <div className="flex flex-col justify-center items-start mt-4 ml-10 mr-8">
        {/* Job Name */}
        <div className="flex flex-row justify-center items-center w-full">
          <h3 className="text-sm font-medium whitespace-nowrap">
            {t("screening.jobName")}
          </h3>
          <input
            type="text"
            className="border-b-2 focus:outline-none border-gray-500 px-2 w-full py-0.5 ml-3"
            placeholder={t("screening.jobName")}
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={(e) => setName(e.target.value.trim())}
          />
        </div>

        {/* Job Description */}
        <h3 className="text-sm font-medium mt-4">{t("screening.jobDescription")} *</h3>
        <Textarea
          value={description}
          className="h-32 mt-2 border-2 border-gray-500 w-full"
          placeholder={t("screening.jobDescriptionPlaceholder")}
          onChange={(e) => setDescription(e.target.value)}
          onBlur={(e) => setDescription(e.target.value.trim())}
        />

        {/* Resume Upload */}
        <h3 className="text-sm font-medium mt-4">{t("screening.uploadResumes")} *</h3>
        <div className="mt-2 w-full">
          <ResumeUpload files={files} setFiles={setFiles} />
        </div>

        {/* Submit Button */}
        <div className="flex flex-row w-full justify-center items-center mt-6 mb-2">
          <Button
            disabled={
              !(name.trim() && description.trim() && files.length > 0) ||
              isSubmitting
            }
            className="bg-indigo-600 hover:bg-indigo-800 w-48 text-lg font-bold"
            onClick={onSubmit}
          >
            {isSubmitting ? t("common.loading") : t("screening.goWork")}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default CreateJobModal;
