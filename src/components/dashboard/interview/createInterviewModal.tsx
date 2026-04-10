import DetailsPopup from "@/components/dashboard/interview/create-popup/details";
import FromJobDetails from "@/components/dashboard/interview/create-popup/fromJobDetails";
import QuestionsPopup from "@/components/dashboard/interview/create-popup/questions";
import LoaderWithLogo from "@/components/loaders/loader-with-logo/loaderWithLogo";
import { useI18n } from "@/i18n";
import type { InterviewBase, Question } from "@/types/interview";
import React, { useEffect, useState } from "react";

interface Props {
  open: boolean;
  setOpen: (open: boolean) => void;
}

const CreateEmptyInterviewData = (language: "zh" | "en" = "zh"): InterviewBase => ({
  user_id: "",
  organization_id: "",
  name: "",
  interviewer_id: BigInt(0),
  objective: "",
  question_count: 0,
  time_duration: "",
  is_anonymous: false,
  questions: [],
  description: "",
  response_count: BigInt(0),
  language,
});

type TabType = "manual" | "fromJob";

function CreateInterviewModal({ open, setOpen }: Props) {
  const [loading, setLoading] = useState(false);
  const [proceed, setProceed] = useState(false);
  const [interviewData, setInterviewData] = useState<InterviewBase>(CreateEmptyInterviewData());
  const [extraQuestions, setExtraQuestions] = useState<Question[]>([]);
  const [activeTab, setActiveTab] = useState<TabType>("manual");
  const { t } = useI18n();

  // Below for File Upload
  const [isUploaded, setIsUploaded] = useState(false);
  const [fileName, setFileName] = useState("");

  // biome-ignore lint/correctness/useExhaustiveDependencies: intentionally omit loading from deps — proceed only when interviewData updates while loading is true
  useEffect(() => {
    if (loading === true) {
      setLoading(false);
      setProceed(true);
    }
  }, [interviewData]);

  useEffect(() => {
    if (!open) {
      setLoading(false);
      setProceed(false);
      setInterviewData(CreateEmptyInterviewData());
      setExtraQuestions([]);
      setActiveTab("manual");
      // Below for File Upload
      setIsUploaded(false);
      setFileName("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return (
    <>
      {loading ? (
        <div className="w-[38rem] h-[35.3rem]">
          <LoaderWithLogo />
        </div>
      ) : !proceed ? (
        <div>
          {/* Tab Header */}
          <div className="flex justify-center mb-2">
            <h1 className="text-xl font-semibold">{t("create.createInterview")}</h1>
          </div>
          <div className="flex border-b border-gray-200 mb-2 px-10">
            <button
              type="button"
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                activeTab === "manual"
                  ? "border-b-2 border-indigo-600 text-indigo-600"
                  : "text-gray-500 hover:text-gray-700"
              }`}
              onClick={() => setActiveTab("manual")}
            >
              {t("create.tabManual")}
            </button>
            <button
              type="button"
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                activeTab === "fromJob"
                  ? "border-b-2 border-indigo-600 text-indigo-600"
                  : "text-gray-500 hover:text-gray-700"
              }`}
              onClick={() => setActiveTab("fromJob")}
            >
              {t("create.tabFromJob")}
            </button>
          </div>

          {/* Tab Content */}
          {activeTab === "manual" ? (
            <DetailsPopup
              open={open}
              setLoading={setLoading}
              interviewData={interviewData}
              setInterviewData={setInterviewData}
              setExtraQuestions={setExtraQuestions}
              // Below for File Upload
              isUploaded={isUploaded}
              setIsUploaded={setIsUploaded}
              fileName={fileName}
              setFileName={setFileName}
            />
          ) : (
            <FromJobDetails
              open={open}
              setLoading={setLoading}
              interviewData={interviewData}
              setInterviewData={setInterviewData}
              setExtraQuestions={setExtraQuestions}
            />
          )}
        </div>
      ) : (
        <QuestionsPopup
          interviewData={interviewData}
          extraQuestions={extraQuestions}
          setProceed={setProceed}
          setOpen={setOpen}
        />
      )}
    </>
  );
}

export default CreateInterviewModal;
