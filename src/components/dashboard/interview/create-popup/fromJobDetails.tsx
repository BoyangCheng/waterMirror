"use client";

import Modal from "@/components/dashboard/Modal";
import InterviewerDetailsModal from "@/components/dashboard/interviewer/interviewerDetailsModal";
import { Button } from "@/components/ui/button";
import { CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { useInterviewers } from "@/contexts/interviewers.context";
import { useJobs } from "@/contexts/jobs.context";
import { useI18n } from "@/i18n";
import { getIntervieweesByJobId } from "@/services/interviewees.service";
import type { InterviewBase, Question } from "@/types/interview";
import type { Interviewer } from "@/types/interviewer";
import type { Interviewee, Job } from "@/types/job";
import axios from "axios";
import { ChevronDown, ChevronLeft, ChevronRight, Info } from "lucide-react";
import Image from "next/image";
import React, { useState, useEffect } from "react";
import { v4 as uuidv4 } from "uuid";

interface Props {
  open: boolean;
  setLoading: (loading: boolean) => void;
  interviewData: InterviewBase;
  setInterviewData: (interviewData: InterviewBase) => void;
}

function FromJobDetails({
  open,
  setLoading,
  interviewData,
  setInterviewData,
}: Props) {
  const { interviewers } = useInterviewers();
  const { jobs } = useJobs();
  const { t } = useI18n();

  const [isClicked, setIsClicked] = useState(false);
  const [openInterviewerDetails, setOpenInterviewerDetails] = useState(false);
  const [interviewerDetails, setInterviewerDetails] = useState<Interviewer>();

  // Job & interviewee selection
  const [selectedJobId, setSelectedJobId] = useState("");
  const [interviewees, setInterviewees] = useState<Interviewee[]>([]);
  const [selectedIntervieweeId, setSelectedIntervieweeId] = useState<number | null>(null);
  const [loadingInterviewees, setLoadingInterviewees] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  // Shared fields
  const [selectedInterviewer, setSelectedInterviewer] = useState(interviewData.interviewer_id);
  const [isAnonymous, setIsAnonymous] = useState<boolean>(interviewData.is_anonymous);
  const [numQuestions, setNumQuestions] = useState(
    interviewData.question_count === 0 ? "" : String(interviewData.question_count),
  );
  const [duration, setDuration] = useState(interviewData.time_duration);

  const completedJobs = jobs.filter((j) => j.status === "completed");
  const selectedJob = completedJobs.find((j) => j.id === selectedJobId);
  const selectedInterviewee = interviewees.find((i) => i.id === selectedIntervieweeId);

  // Fetch interviewees when job is selected
  useEffect(() => {
    if (!selectedJobId) {
      setInterviewees([]);
      setSelectedIntervieweeId(null);
      return;
    }

    const fetchInterviewees = async () => {
      setLoadingInterviewees(true);
      try {
        const data = await getIntervieweesByJobId(selectedJobId);
        setInterviewees(data as Interviewee[]);
      } catch (error) {
        console.error(error);
      }
      setLoadingInterviewees(false);
    };

    fetchInterviewees();
  }, [selectedJobId]);

  // Reset on close
  useEffect(() => {
    if (!open) {
      setSelectedJobId("");
      setInterviewees([]);
      setSelectedIntervieweeId(null);
      setSelectedInterviewer(BigInt(0));
      setIsAnonymous(false);
      setNumQuestions("");
      setDuration("");
      setIsClicked(false);
      setDropdownOpen(false);
    }
  }, [open]);

  const slideLeft = (id: string, value: number) => {
    const slider = document.getElementById(`${id}`);
    if (slider) {
      slider.scrollLeft = slider.scrollLeft - value;
    }
  };

  const slideRight = (id: string, value: number) => {
    const slider = document.getElementById(`${id}`);
    if (slider) {
      slider.scrollLeft = slider.scrollLeft + value;
    }
  };

  const buildInterviewName = () => {
    const jobName = selectedJob?.name || "";
    const candidateName = selectedInterviewee?.name || "";
    return `${jobName} - ${candidateName}`;
  };

  const buildObjective = () => {
    const jd = selectedJob?.description || "";
    const summary = selectedInterviewee?.summary || "";
    return `职位描述: ${jd}\n\n候选人亮点: ${summary}`;
  };

  const onGenrateQuestions = async () => {
    setLoading(true);

    const name = buildInterviewName();
    const objective = buildObjective();

    const data = {
      name: name.trim(),
      objective: objective.trim(),
      number: numQuestions,
      context: "",
    };

    try {
      const generatedQuestions = (await axios.post(
        "/api/generate-interview-questions",
        data,
      )) as any;

      const rawResponse = generatedQuestions?.data?.response;
      console.log("[generate-questions] raw response:", rawResponse);

      const generatedQuestionsResponse = JSON.parse(rawResponse);

      if (!Array.isArray(generatedQuestionsResponse?.questions)) {
        throw new Error(
          `Invalid response shape — missing "questions" array: ${rawResponse}`,
        );
      }

      const updatedQuestions = generatedQuestionsResponse.questions.map((question: Question) => ({
        id: uuidv4(),
        question: question.question.trim(),
        follow_up_count: 1,
      }));

      const updatedInterviewData = {
        ...interviewData,
        name: name.trim(),
        objective: objective.trim(),
        questions: updatedQuestions,
        interviewer_id: selectedInterviewer,
        question_count: Number(numQuestions),
        time_duration: duration,
        description: generatedQuestionsResponse.description,
        is_anonymous: isAnonymous,
      };
      setInterviewData(updatedInterviewData);
    } catch (err) {
      console.error("[generate-questions] failed:", err);
      setLoading(false);
      alert(
        `生成面试问题失败：${err instanceof Error ? err.message : String(err)}`,
      );
    }
  };

  const onManual = () => {
    setLoading(true);

    const name = buildInterviewName();
    const objective = buildObjective();

    const updatedInterviewData = {
      ...interviewData,
      name: name.trim(),
      objective: objective.trim(),
      questions: [{ id: uuidv4(), question: "", follow_up_count: 1 }],
      interviewer_id: selectedInterviewer,
      question_count: Number(numQuestions),
      time_duration: String(duration),
      description: "",
      is_anonymous: isAnonymous,
    };
    setInterviewData(updatedInterviewData);
  };

  const canProceed =
    selectedJobId &&
    selectedIntervieweeId !== null &&
    numQuestions &&
    duration &&
    selectedInterviewer !== BigInt(0);

  return (
    <>
      <div className="text-center w-[38rem]">
        <div className="flex flex-col justify-center items-start mt-2 ml-10 mr-8">
          {/* Job Dropdown */}
          <h3 className="text-sm font-medium">{t("create.selectJob")}</h3>
          <div className="relative w-full mt-2">
            <button
              type="button"
              className="w-full border-2 border-gray-500 rounded-md px-3 py-2 text-left text-sm flex items-center justify-between hover:bg-gray-50"
              onClick={() => setDropdownOpen(!dropdownOpen)}
            >
              <span className={selectedJob ? "text-gray-800" : "text-gray-400"}>
                {selectedJob ? selectedJob.name : t("create.selectJobPlaceholder")}
              </span>
              <ChevronDown
                size={16}
                className={`transition-transform ${dropdownOpen ? "rotate-180" : ""}`}
              />
            </button>
            {dropdownOpen && (
              <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-40 overflow-y-auto">
                {completedJobs.length === 0 ? (
                  <div className="px-3 py-2 text-sm text-gray-400">
                    {t("create.noCompletedJobs")}
                  </div>
                ) : (
                  completedJobs.map((job) => (
                    <button
                      type="button"
                      key={job.id}
                      className={`w-full px-3 py-2 text-left text-sm hover:bg-indigo-50 ${
                        selectedJobId === job.id ? "bg-indigo-100 font-medium" : ""
                      }`}
                      onClick={() => {
                        setSelectedJobId(job.id);
                        setSelectedIntervieweeId(null);
                        setDropdownOpen(false);
                      }}
                    >
                      {job.name}
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Interviewee List */}
          {selectedJobId && (
            <div className="w-full mt-4">
              <h3 className="text-sm font-medium">{t("create.selectCandidate")}</h3>
              {loadingInterviewees ? (
                <div className="mt-2 space-y-2">
                  <div className="h-8 w-full animate-pulse rounded bg-gray-200" />
                  <div className="h-8 w-full animate-pulse rounded bg-gray-200" />
                </div>
              ) : interviewees.length === 0 ? (
                <p className="text-sm text-gray-400 mt-2">{t("create.noCandidates")}</p>
              ) : (
                <div className="mt-2 max-h-48 overflow-y-auto border border-gray-200 rounded-md">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-50 sticky top-0">
                      <tr>
                        <th className="px-2 py-1.5 text-left font-medium text-gray-500" />
                        <th className="px-2 py-1.5 text-left font-medium text-gray-500">
                          {t("screening.candidateName")}
                        </th>
                        <th className="px-2 py-1.5 text-left font-medium text-gray-500">
                          {t("screening.company")}
                        </th>
                        <th className="px-2 py-1.5 text-left font-medium text-gray-500">
                          {t("screening.position")}
                        </th>
                        <th className="px-2 py-1.5 text-left font-medium text-gray-500 max-w-[120px]">
                          {t("screening.highlightSummary")}
                        </th>
                        <th className="px-2 py-1.5 text-center font-medium text-gray-500 w-10">
                          {t("screening.score")}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {interviewees
                        .filter((i) => i.status === "analyzed")
                        .map((interviewee) => (
                          <tr
                            key={interviewee.id}
                            className={`border-t border-gray-100 cursor-pointer hover:bg-indigo-50 transition-colors ${
                              selectedIntervieweeId === interviewee.id
                                ? "bg-indigo-100"
                                : ""
                            }`}
                            onClick={() => setSelectedIntervieweeId(interviewee.id)}
                          >
                            <td className="px-2 py-1.5">
                              <div
                                className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                                  selectedIntervieweeId === interviewee.id
                                    ? "border-indigo-600"
                                    : "border-gray-300"
                                }`}
                              >
                                {selectedIntervieweeId === interviewee.id && (
                                  <div className="w-2 h-2 rounded-full bg-indigo-600" />
                                )}
                              </div>
                            </td>
                            <td className="px-2 py-1.5 font-medium text-gray-800">
                              {interviewee.name || "-"}
                            </td>
                            <td className="px-2 py-1.5 text-gray-600">
                              {interviewee.company || "-"}
                            </td>
                            <td className="px-2 py-1.5 text-gray-600">
                              {interviewee.position || "-"}
                            </td>
                            <td className="px-2 py-1.5 text-gray-600 max-w-[120px] truncate">
                              {interviewee.summary || "-"}
                            </td>
                            <td className="px-2 py-1.5 text-center">
                              <span
                                className={`font-semibold ${
                                  interviewee.score >= 80
                                    ? "text-green-600"
                                    : interviewee.score >= 60
                                      ? "text-amber-500"
                                      : "text-red-500"
                                }`}
                              >
                                {interviewee.score}
                              </span>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Interviewer Selection */}
          <h3 className="text-sm mt-3 font-medium">{t("create.selectInterviewer")}</h3>
          <div className="relative flex items-center mt-1">
            <div
              id="slider-from-job"
              className="h-36 pt-1 overflow-x-scroll scroll whitespace-nowrap scroll-smooth scrollbar-hide w-[27.5rem]"
            >
              {interviewers.map((item) => (
                <div
                  className="p-0 inline-block cursor-pointer ml-1 mr-5 rounded-xl shrink-0 overflow-hidden"
                  key={item.id}
                >
                  <button
                    type="button"
                    className="absolute ml-9"
                    onClick={(e) => {
                      e.stopPropagation();
                      setInterviewerDetails(item);
                      setOpenInterviewerDetails(true);
                    }}
                  >
                    <Info size={18} color="#4f46e5" strokeWidth={2.2} />
                  </button>
                  <button
                    type="button"
                    className={`w-[96px] overflow-hidden rounded-full ${
                      selectedInterviewer === item.id ? "border-4 border-indigo-600" : ""
                    }`}
                    onClick={() => setSelectedInterviewer(item.id)}
                  >
                    {item.image ? (
                      <Image
                        src={item.image}
                        alt="Picture of the interviewer"
                        width={70}
                        height={70}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-[96px] h-[96px] bg-gray-200 rounded-full flex items-center justify-center text-gray-400 text-xl">
                        {item.name?.[0] ?? "?"}
                      </div>
                    )}
                  </button>
                  <CardTitle className="mt-0 text-xs text-center">{item.name}</CardTitle>
                </div>
              ))}
            </div>
            {interviewers.length > 4 ? (
              <div className="flex-row justify-center ml-3 mb-1 items-center space-y-6">
                <ChevronRight
                  className="opacity-50 cursor-pointer hover:opacity-100"
                  size={27}
                  onClick={() => slideRight("slider-from-job", 115)}
                />
                <ChevronLeft
                  className="opacity-50 cursor-pointer hover:opacity-100"
                  size={27}
                  onClick={() => slideLeft("slider-from-job", 115)}
                />
              </div>
            ) : (
              <></>
            )}
          </div>

          {/* Anonymous Toggle */}
          <div className="flex-col w-full">
            <div className="flex items-center cursor-pointer">
              <span className="text-sm font-medium">
                {t("interview.anonymousQuestion")}
              </span>
              <Switch
                checked={isAnonymous}
                className={`ml-4 mt-1 ${isAnonymous ? "bg-indigo-600" : "bg-[#E6E7EB]"}`}
                onCheckedChange={(checked) => setIsAnonymous(checked)}
              />
            </div>
            <span
              style={{ fontSize: "0.7rem", lineHeight: "0.66rem" }}
              className="font-light text-xs italic w-full text-left block"
            >
              {t("interview.anonymousNote")}
            </span>
          </div>

          {/* Questions & Duration */}
          <div className="flex flex-row gap-3 justify-between w-full mt-3">
            <div className="flex flex-row justify-center items-center">
              <h3 className="text-sm font-medium">{t("create.numberOfQuestions")}</h3>
              <input
                type="number"
                step="1"
                max="5"
                min="1"
                className="border-b-2 text-center focus:outline-none border-gray-500 w-14 px-2 py-0.5 ml-3"
                value={numQuestions}
                onChange={(e) => {
                  let value = e.target.value;
                  if (value === "" || (Number.isInteger(Number(value)) && Number(value) > 0)) {
                    if (Number(value) > 5) {
                      value = "5";
                    }
                    setNumQuestions(value);
                  }
                }}
              />
            </div>
            <div className="flex flex-row justify-center items-center">
              <h3 className="text-sm font-medium">{t("interview.duration")}</h3>
              <input
                type="number"
                step="1"
                max="30"
                min="1"
                className="border-b-2 text-center focus:outline-none border-gray-500 w-14 px-2 py-0.5 ml-3"
                value={duration}
                onChange={(e) => {
                  let value = e.target.value;
                  if (value === "" || (Number.isInteger(Number(value)) && Number(value) > 0)) {
                    if (Number(value) > 30) {
                      value = "30";
                    }
                    setDuration(value);
                  }
                }}
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-row w-full justify-center items-center space-x-24 mt-5">
            <Button
              disabled={!canProceed || isClicked}
              className="bg-indigo-600 hover:bg-indigo-800 w-40"
              onClick={() => {
                setIsClicked(true);
                onGenrateQuestions();
              }}
            >
              {t("create.generateQuestions")}
            </Button>
            <Button
              disabled={!canProceed || isClicked}
              className="bg-indigo-600 w-40 hover:bg-indigo-800"
              onClick={() => {
                setIsClicked(true);
                onManual();
              }}
            >
              {t("create.doItMyself")}
            </Button>
          </div>
        </div>
      </div>
      <Modal
        open={openInterviewerDetails}
        closeOnOutsideClick={true}
        onClose={() => {
          setOpenInterviewerDetails(false);
        }}
      >
        <InterviewerDetailsModal interviewer={interviewerDetails} />
      </Modal>
    </>
  );
}

export default FromJobDetails;
