"use client";

import { Inbox, X } from "lucide-react";
import { useI18n } from "@/i18n";
import { useDropzone } from "react-dropzone";
import { toast } from "sonner";

type Props = {
  files: File[];
  setFiles: (files: File[]) => void;
};

function ResumeUpload({ files, setFiles }: Props) {
  const { t } = useI18n();

  const { getRootProps, getInputProps } = useDropzone({
    accept: { "application/pdf": [".pdf"] },
    maxFiles: 10,
    onDrop: (acceptedFiles: File[]) => {
      const totalFiles = [...files, ...acceptedFiles];

      if (totalFiles.length > 10) {
        toast.error(t("screening.maxFiles"), {
          position: "bottom-right",
          duration: 3000,
        });
        return;
      }

      for (const file of acceptedFiles) {
        if (file.size > 10 * 1024 * 1024) {
          toast.error(t("screening.fileTooLarge"), {
            position: "bottom-right",
            duration: 3000,
          });
          return;
        }
      }

      setFiles(totalFiles);
    },
    onDropRejected: () => {
      toast.error(t("screening.onlyPdf"), {
        position: "bottom-right",
        duration: 3000,
      });
    },
  });

  const removeFile = (index: number) => {
    const updated = files.filter((_, i) => i !== index);
    setFiles(updated);
  };

  return (
    <div className="w-full">
      <div
        {...getRootProps({
          className:
            "border-dashed border-2 rounded-xl cursor-pointer bg-gray-50 py-4 flex justify-center items-center flex-col",
        })}
      >
        <input {...getInputProps()} />
        <Inbox className="w-8 h-8 text-blue-500" />
        <p className="mt-2 text-sm text-slate-400">
          {t("screening.uploadResumes")}
        </p>
      </div>

      {files.length > 0 && (
        <div className="mt-3 space-y-1 max-h-40 overflow-y-auto">
          {files.map((file, index) => (
            <div
              key={`${file.name}-${index}`}
              className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-1.5 text-sm"
            >
              <span className="text-slate-600 truncate max-w-[80%]">
                {file.name}
              </span>
              <button
                type="button"
                onClick={() => removeFile(index)}
                className="text-gray-400 hover:text-red-500 ml-2 shrink-0"
              >
                <X size={16} />
              </button>
            </div>
          ))}
          <p className="text-xs text-slate-400 mt-1">
            {files.length}/10 {t("screening.resumeCount")}
          </p>
        </div>
      )}
    </div>
  );
}

export default ResumeUpload;
