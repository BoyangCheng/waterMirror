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
import Modal from "@/components/dashboard/Modal";
import InterviewerDetailsModal from "@/components/dashboard/interviewer/interviewerDetailsModal";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import { useInterviewers } from "@/contexts/interviewers.context";
import { useI18n } from "@/i18n";
import type { Interviewer } from "@/types/interviewer";
import { Trash2 } from "lucide-react";
import Image from "next/image";
import { useState } from "react";

interface Props {
  interviewer: Interviewer;
}

const interviewerCard = ({ interviewer }: Props) => {
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const [open, setOpen] = useState(false);
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const { deleteInterviewer } = useInterviewers();
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const { t } = useI18n();

  return (
    <>
      <div className="relative inline-block ml-1 mr-3">
        <Card
          className="p-0 cursor-pointer hover:scale-105 ease-in-out duration-300 h-40 w-36 rounded-xl shrink-0 overflow-hidden shadow-md"
          onClick={() => setOpen(true)}
        >
          <CardContent className="p-0">
            <div className="w-full h-28 overflow-hidden">
              {interviewer.image ? (
                <Image
                  src={interviewer.image}
                  alt="Picture of the interviewer"
                  width={200}
                  height={40}
                  className="w-full h-full object-cover object-center"
                />
              ) : (
                <div className="w-full h-full bg-gray-200 flex items-center justify-center text-gray-400 text-2xl">
                  {interviewer.name?.[0] ?? "?"}
                </div>
              )}
            </div>
            <CardTitle className="mt-3 text-base text-center">{interviewer.name}</CardTitle>
          </CardContent>
        </Card>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              className="absolute top-1 right-1 h-6 w-6 p-0 text-red-400 bg-white/80 hover:bg-white hover:text-red-600"
              variant="secondary"
              onClick={(e) => e.stopPropagation()}
            >
              <Trash2 size={13} />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t("common.areYouSure")}</AlertDialogTitle>
              <AlertDialogDescription>{t("interviewerSettings.deleteConfirm")}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
              <AlertDialogAction onClick={() => deleteInterviewer(interviewer.id)}>
                {t("common.continue")}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
      <Modal
        open={open}
        closeOnOutsideClick={true}
        onClose={() => {
          setOpen(false);
        }}
      >
        <InterviewerDetailsModal interviewer={interviewer} />
      </Modal>
    </>
  );
};

export default interviewerCard;
