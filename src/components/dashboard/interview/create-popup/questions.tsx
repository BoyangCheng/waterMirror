"use client";

import QuestionCard from "@/components/dashboard/interview/create-popup/questionCard";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAuth, useOrg } from "@/contexts/auth.context";
import { useInterviews } from "@/contexts/interviews.context";
import { useI18n } from "@/i18n";
import type { InterviewBase, Question } from "@/types/interview";
import { DndContext, closestCenter, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, arrayMove } from "@dnd-kit/sortable";
import axios from "axios";
import { Plus } from "lucide-react";
import { ChevronLeft } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { v4 as uuidv4 } from "uuid";

interface Props {
  interviewData: InterviewBase;
  extraQuestions?: Question[];
  setProceed: (proceed: boolean) => void;
  setOpen: (open: boolean) => void;
}

function QuestionsPopup({ interviewData, extraQuestions = [], setProceed, setOpen }: Props) {
  const { user } = useAuth();
  const { organization } = useOrg();
  const [isClicked, setIsClicked] = useState(false);
  const { t } = useI18n();

  const [questions, setQuestions] = useState<Question[]>(interviewData.questions);
  const [description, setDescription] = useState<string>(interviewData.description.trim());
  const { fetchInterviews } = useInterviews();

  const endOfListRef = useRef<HTMLDivElement>(null);
  const prevQuestionLengthRef = useRef(questions.length);
  const extraCursorRef = useRef(0);

  const handleInputChange = (id: string, newQuestion: Question) => {
    setQuestions(
      questions.map((question) =>
        question.id === id ? { ...question, ...newQuestion } : question,
      ),
    );
  };

  const handleDeleteQuestion = (id: string) => {
    if (questions.length === 1) {
      setQuestions(
        questions.map((question) => ({
          ...question,
          question: "",
          follow_up_count: 1,
        })),
      );

      return;
    }
    setQuestions(questions.filter((question) => question.id !== id));
  };

  const handleAddQuestion = () => {
    if (questions.length < interviewData.question_count) {
      let nextQuestionText = "";
      if (extraQuestions.length > 0) {
        const nextExtra = extraQuestions[extraCursorRef.current % extraQuestions.length];
        nextQuestionText = nextExtra?.question ?? "";
        extraCursorRef.current += 1;
      }
      setQuestions([
        ...questions,
        { id: uuidv4(), question: nextQuestionText, follow_up_count: 1 },
      ]);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = questions.findIndex((q) => q.id === active.id);
      const newIndex = questions.findIndex((q) => q.id === over.id);
      setQuestions(arrayMove(questions, oldIndex, newIndex));
    }
  };

  const onSave = async () => {
    try {
      interviewData.user_id = user?.id || "";
      interviewData.organization_id = organization?.id || "";

      interviewData.questions = questions;
      interviewData.description = description;

      // Convert BigInts to strings if necessary
      const sanitizedInterviewData = {
        ...interviewData,
        interviewer_id: interviewData.interviewer_id.toString(),
        response_count: interviewData.response_count.toString(),
        logo_url: organization?.imageUrl || "",
      };

      const response = await axios.post("/api/create-interview", {
        organizationName: organization?.name,
        interviewData: sanitizedInterviewData,
      });
      setIsClicked(false);
      fetchInterviews();
      setOpen(false);
    } catch (error) {
      console.error("Error creating interview:", error);
    }
  };

  useEffect(() => {
    if (questions.length > prevQuestionLengthRef.current) {
      endOfListRef.current?.scrollIntoView({ behavior: "smooth" });
    }
    prevQuestionLengthRef.current = questions.length;
  }, [questions.length]);

  return (
    <div>
      <div
        className={`text-center px-1 flex flex-col justify-top items-center w-[38rem] ${
          interviewData.question_count > 1 ? "h-[29rem]" : ""
        } `}
      >
        <div className="relative flex justify-center w-full">
          <ChevronLeft
            className="absolute left-0 opacity-50 cursor-pointer hover:opacity-100 text-gray-600 mr-36"
            size={30}
            onClick={() => {
              setProceed(false);
            }}
          />
          <h1 className="text-2xl font-semibold">{t("create.createInterview")}</h1>
        </div>
        <div className="my-3 text-left w-[96%] text-sm">
          {t("create.questionsReview")}
        </div>
        <div className="w-[96%] text-left text-xs text-indigo-500 italic mb-2 px-1">
          {t("openingHint")}
        </div>
        <ScrollArea className="flex flex-col justify-center items-center w-full mt-3">
          <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={questions.map((q) => q.id)} strategy={verticalListSortingStrategy}>
              {questions.map((question, index) => (
                <QuestionCard
                  key={question.id}
                  questionNumber={index + 1}
                  questionData={question}
                  onDelete={handleDeleteQuestion}
                  onQuestionChange={handleInputChange}
                />
              ))}
            </SortableContext>
          </DndContext>
          <div ref={endOfListRef} />
        </ScrollArea>
        {questions.length < interviewData.question_count ? (
          <button
            type="button"
            className="border-indigo-600 opacity-75 hover:opacity-100 w-fit rounded-full"
            onClick={handleAddQuestion}
          >
            <Plus size={45} strokeWidth={2.2} className="text-indigo-600 cursor-pointer" />
          </button>
        ) : (
          <></>
        )}
      </div>
      <p className="mt-3 mb-1 ml-2 font-medium">
        {t("interview.description")}{" "}
        <span
          style={{ fontSize: "0.7rem", lineHeight: "0.66rem" }}
          className="font-light text-xs italic w-full text-left block"
        >
          {t("create.descriptionNoteInterviewees")}
        </span>
      </p>
      <textarea
        value={description}
        className="h-fit mt-3 mx-2 py-2 border-2 rounded-md px-2 w-full border-gray-400"
        placeholder={t("create.descriptionPlaceholderShort")}
        rows={3}
        onChange={(e) => {
          setDescription(e.target.value);
        }}
        onBlur={(e) => {
          setDescription(e.target.value.trim());
        }}
      />
      <div className="flex flex-row justify-end items-end w-full">
        <Button
          disabled={
            isClicked ||
            questions.length < interviewData.question_count ||
            description.trim() === "" ||
            questions.some((question) => question.question.trim() === "")
          }
          className="bg-indigo-600 hover:bg-indigo-800 mr-5 mt-2"
          onClick={() => {
            setIsClicked(true);
            onSave();
          }}
        >
          {t("common.save")}
        </Button>
      </div>
    </div>
  );
}
export default QuestionsPopup;
