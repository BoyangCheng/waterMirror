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
import { useAuth, useOrg } from "@/contexts/auth.context";
import { useI18n } from "@/i18n";
import { useDeleteInterviewMutation } from "@/hooks/useInterviewsQuery";
import { getInterviewer } from "@/services/interviewers.service";
import { ArrowUpRight, Copy, Trash2 } from "lucide-react";
import { CopyCheck } from "lucide-react";
import Image from "next/image";
import { useEffect, useState } from "react";
import { toast } from "sonner";

interface Props {
  name: string | null;
  interviewerId: bigint;
  id: string;
  url: string;
  readableSlug: string;
  responseCount: number;
  timeDuration?: string;
}

const base_url = process.env.NEXT_PUBLIC_LIVE_URL;

function InterviewCard({ name, interviewerId, id, url, readableSlug, responseCount, timeDuration }: Props) {
  const [copied, setCopied] = useState(false);
  const [img, setImg] = useState("");
  const [interviewerName, setInterviewerName] = useState("");
  const [imgError, setImgError] = useState(false);
  const [fetched, setFetched] = useState(false);
  const { t } = useI18n();
  const { user } = useAuth();
  const { organization } = useOrg();
  const deleteInterviewMutation = useDeleteInterviewMutation(user?.id, organization?.id);

  // biome-ignore lint/correctness/useExhaustiveDependencies: <explanation>
  useEffect(() => {
    const fetchInterviewer = async () => {
      try {
        const interviewer = await getInterviewer(interviewerId);
        if (interviewer) {
          if (interviewer.image) setImg(interviewer.image);
          if (interviewer.name) setInterviewerName(interviewer.name);
        }
      } finally {
        setFetched(true);
      }
    };
    fetchInterviewer();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleDelete = (event: React.MouseEvent) => {
    event.stopPropagation();
    event.preventDefault();
    console.log("[InterviewCard] handleDelete → id:", id, "| userId:", user?.id, "| orgId:", organization?.id);
    deleteInterviewMutation.mutate(id);
  };

  const copyToClipboard = () => {
    const link = readableSlug ? `${base_url}/call/${readableSlug}` : `${base_url}/call/${id}`;
    const message = t("interview.shareMessageTemplate", {
      orgName: organization?.name ?? "",
      duration: timeDuration ?? "",
      link,
    });
    navigator.clipboard.writeText(message).then(
      () => {
        setCopied(true);
        toast.success(t("interview.infoCopied"), {
          position: "bottom-right",
          duration: 3000,
        });
        setTimeout(() => {
          setCopied(false);
        }, 2000);
      },
      (err) => {
        console.log("failed to copy", err.mesage);
      },
    );
  };

  const handleJumpToInterview = (event: React.MouseEvent) => {
    event.stopPropagation();
    event.preventDefault();
    const interviewUrl = readableSlug ? `/call/${readableSlug}` : `/call/${id}`;
    window.open(interviewUrl, "_blank");
  };

  return (
    <a href={`/interviews/${id}`}>
      <Card className="relative p-0 mt-4 inline-block cursor-pointer h-60 w-56 ml-1 mr-3 rounded-xl shrink-0 overflow-hidden shadow-md">
        <CardContent className="p-0">
          <div className="w-full h-40 overflow-hidden bg-indigo-600 flex items-center text-center">
            <CardTitle className="w-full mt-3 mx-2 text-white text-lg">
              {name}
            </CardTitle>
          </div>
          <div className="flex flex-row items-center mx-4">
            <div className="w-full overflow-hidden">
              {img && !imgError ? (
                <Image
                  src={img}
                  alt="Picture of the interviewer"
                  width={70}
                  height={70}
                  className="object-cover object-center rounded-full"
                  onError={() => setImgError(true)}
                />
              ) : fetched ? (
                <div className="w-[70px] h-[70px] rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-xl font-semibold">
                  {(interviewerName || name || "?").trim().charAt(0).toUpperCase()}
                </div>
              ) : (
                <div className="w-[70px] h-[70px] bg-gray-200 rounded-full animate-pulse" />
              )}
            </div>
            <div className="mt-2 mr-2 whitespace-nowrap">
              {responseCount > 0 ? (
                <span className="text-xs font-semibold text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
                  {t("create.interviewed")}
                </span>
              ) : (
                <span className="text-xs font-semibold text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                  {t("create.notInterviewed")}
                </span>
              )}
            </div>
          </div>
          <div className="absolute top-2 right-2 flex gap-1">
            <Button
              className="text-xs text-indigo-600 px-1 h-6"
              variant={"secondary"}
              title={t("interview.testInterview")}
              onClick={handleJumpToInterview}
            >
              <ArrowUpRight size={16} />
            </Button>
            <Button
              className={`text-xs text-indigo-600 px-1 h-6  ${
                copied ? "bg-indigo-300 text-white" : ""
              }`}
              variant={"secondary"}
              title={t("interview.shareInterviewInfo")}
              onClick={(event) => {
                event.stopPropagation();
                event.preventDefault();
                copyToClipboard();
              }}
            >
              {copied ? <CopyCheck size={16} /> : <Copy size={16} />}
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  className="text-xs text-red-500 px-1 h-6"
                  variant={"secondary"}
                  title={t("interview.deleteInterview")}
                  onClick={(e) => { e.stopPropagation(); e.preventDefault(); }}
                >
                  <Trash2 size={16} />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>{t("common.areYouSure")}</AlertDialogTitle>
                  <AlertDialogDescription>{t("interview.deleteConfirm")}</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel onClick={(e) => { e.stopPropagation(); e.preventDefault(); }}>
                    {t("common.cancel")}
                  </AlertDialogCancel>
                  <AlertDialogAction onClick={handleDelete}>
                    {t("common.continue")}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </CardContent>
      </Card>
    </a>
  );
}

export default InterviewCard;
