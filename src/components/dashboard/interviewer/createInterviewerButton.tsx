"use client";

import Modal from "@/components/dashboard/Modal";
import CreateInterviewerModal from "@/components/dashboard/interviewer/createInterviewerModal";
import { Card, CardContent } from "@/components/ui/card";
import { useI18n } from "@/i18n";
import { Plus } from "lucide-react";
import { useState } from "react";

function CreateInterviewerButton() {
  const [open, setOpen] = useState(false);
  const { t } = useI18n();

  return (
    <>
      <Card
        className="p-0 inline-block cursor-pointer hover:scale-105 ease-in-out duration-300 h-40 w-36 ml-1 mr-3 rounded-xl shrink-0 overflow-hidden shadow-md"
        onClick={() => setOpen(true)}
      >
        <CardContent className="p-0">
          <div className="w-full h-20 overflow-hidden flex justify-center items-center">
            <Plus size={40} />
          </div>
          <p className="my-3 mx-auto text-xs text-wrap w-fit text-center">
            {t("interviewerSettings.createNew")}
          </p>
        </CardContent>
      </Card>
      <Modal open={open} closeOnOutsideClick={true} onClose={() => setOpen(false)}>
        <CreateInterviewerModal onClose={() => setOpen(false)} />
      </Modal>
    </>
  );
}

export default CreateInterviewerButton;

