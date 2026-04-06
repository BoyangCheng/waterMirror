"use client";

import { CardTitle } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { useI18n } from "@/i18n";
import type { Interviewer } from "@/types/interviewer";
import Image from "next/image";
import ReactAudioPlayer from "react-audio-player";
import { useState } from "react";

interface Props {
  interviewer: Interviewer | undefined;
}

function InterviewerDetailsModal({ interviewer }: Props) {
  const { t } = useI18n();
  const [previewing, setPreviewing] = useState(false);

  const handlePreview = async () => {
    if (previewing || !interviewer?.agent_id) return;
    setPreviewing(true);
    try {
      const res = await fetch("/api/voice-preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ voice_type: interviewer.agent_id }),
      });
      if (!res.ok) throw new Error("preview failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audio.onended = () => { URL.revokeObjectURL(url); setPreviewing(false); };
      audio.onerror = () => setPreviewing(false);
      audio.play();
    } catch {
      setPreviewing(false);
    }
  };

  return (
    <div className="text-center w-[40rem]">
      <CardTitle className="text-3xl text mt-0 p-0 font-semibold ">{interviewer?.name}</CardTitle>
      <div className="mt-1 p-2 flex flex-col justify-center items-center">
        <div className="flex flex-row justify-center space-x-10 items-center">
          <div className=" flex items-center justify-center border-4 overflow-hidden border-gray-500 rounded-xl h-48 w-44">
            {interviewer?.image ? (
              <Image
                src={interviewer.image}
                alt="Picture of the interviewer"
                width={180}
                height={30}
                className="w-full h-full object-cover object-center"
              />
            ) : (
              <div className="w-full h-full bg-gray-200 animate-pulse" />
            )}
          </div>
          <div className="flex flex-col gap-2">
            <p className="text-sm leading-relaxed  mt-0 whitespace-normal w-[25rem] text-justify">
              {interviewer?.description}
            </p>
            {interviewer?.audio && (
              <ReactAudioPlayer src={`/audio/${interviewer.audio}`} controls />
            )}
            {!interviewer?.audio && interviewer?.agent_id && (
              <button
                type="button"
                onClick={handlePreview}
                disabled={previewing}
                className="mt-2 flex items-center gap-2 px-4 py-2 rounded-lg border border-indigo-400 text-indigo-600 text-sm hover:bg-indigo-50 disabled:opacity-50 transition-colors"
              >
                <span>{previewing ? "⏳" : "▶"}</span>
                <span>{previewing ? "试听中..." : "试听音色"}</span>
              </button>
            )}
          </div>
        </div>
        <h3 className="text-mg m-0 p-0 mt-5 ml-0 font-medium">{t("interviewerSettings.title")}</h3>
        <div className="flex flex-row space-x-14 justify-center items-start">
          <div className=" mt-2 flex flex-col justify-start items-start">
            <div className="flex flex-row justify-between items-center mb-2">
              <h4 className="w-20 text-left">{t("interviewerSettings.empathy")}</h4>
              <div className="w-40 space-x-3 ml-3 flex justify-between items-center">
                <Slider value={[(interviewer?.empathy || 10) / 10]} max={1} step={0.1} />
                <span className="w-8 text-left">{(interviewer?.empathy || 10) / 10}</span>
              </div>
            </div>
            <div className="flex flex-row justify-between items-center ">
              <h4 className="w-20 text-left">{t("interviewerSettings.rapport")}</h4>
              <div className="w-40 space-x-3 ml-3 flex justify-between items-center">
                <Slider value={[(interviewer?.rapport || 10) / 10]} max={1} step={0.1} />
                <span className="w-8 text-left">{(interviewer?.rapport || 10) / 10}</span>
              </div>
            </div>
          </div>
          <div className=" mt-2 flex flex-col justify-start items-start">
            <div className="flex flex-row justify-between items-center mb-2">
              <h4 className="w-20 text-left">{t("interviewerSettings.exploration")}</h4>
              <div className="w-40 space-x-3 ml-3 flex justify-between items-center">
                <Slider value={[(interviewer?.exploration || 10) / 10]} max={1} step={0.1} />
                <span className="w-8 text-left">{(interviewer?.exploration || 10) / 10}</span>
              </div>
            </div>
            <div className="flex flex-row justify-between items-center ">
              <h4 className="w-20 text-left">{t("interviewerSettings.speed")}</h4>
              <div className="w-40 space-x-3 ml-3 flex justify-between items-center">
                <Slider value={[(interviewer?.speed || 10) / 10]} max={1} step={0.1} />
                <span className="w-8 text-left">{(interviewer?.speed || 10) / 10}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default InterviewerDetailsModal;
