"use client";

import { CardTitle } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { useI18n } from "@/i18n";
import { INTERVIEWERS, PRESET_INTERVIEWER_MAP } from "@/lib/constants";
import type { Interviewer } from "@/types/interviewer";
import Image from "next/image";
import { useState } from "react";

interface Props {
  interviewer: Interviewer | undefined;
}

function InterviewerDetailsModal({ interviewer }: Props) {
  const { t, locale } = useI18n();
  const [previewing, setPreviewing] = useState(false);

  // Local state so sliders are draggable
  const [empathy, setEmpathy] = useState((interviewer?.empathy || 10) / 10);
  const [rapport, setRapport] = useState((interviewer?.rapport || 10) / 10);
  const [exploration, setExploration] = useState((interviewer?.exploration || 10) / 10);
  const [speed, setSpeed] = useState((interviewer?.speed || 10) / 10);

  // Check if this is a preset interviewer and get locale-aware text/audio
  const presetKey = interviewer?.image ? PRESET_INTERVIEWER_MAP[interviewer.image] : undefined;
  const preset = presetKey ? INTERVIEWERS[presetKey] : undefined;

  const displayName = preset
    ? t(`interviewers.${preset.i18nKey}.name` as any)
    : interviewer?.name;

  const displayDescription = preset
    ? t(`interviewers.${preset.i18nKey}.description` as any)
    : interviewer?.description;

  const audioSrc = preset
    ? `/audio/${preset.audio[locale]}`
    : interviewer?.audio
      ? `/audio/${interviewer.audio}`
      : undefined;

  // Voice preview for custom interviewers (no local audio file)
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
      <CardTitle className="text-3xl text mt-0 p-0 font-semibold ">{displayName}</CardTitle>
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
              {displayDescription}
            </p>
            {audioSrc && (
              <audio controls src={audioSrc} preload="metadata" />
            )}
            {!audioSrc && interviewer?.agent_id && (
              <button
                type="button"
                onClick={handlePreview}
                disabled={previewing}
                className="mt-2 flex items-center gap-2 px-4 py-2 rounded-lg border border-indigo-400 text-indigo-600 text-sm hover:bg-indigo-50 disabled:opacity-50 transition-colors"
              >
                <span>{previewing ? "\u23F3" : "\u25B6"}</span>
                <span>{previewing ? t("interviewerSettings.previewing" as any) || "Previewing..." : t("interviewerSettings.previewVoice" as any) || "Preview Voice"}</span>
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
                <Slider value={[empathy]} max={1} step={0.1} onValueChange={([v]) => setEmpathy(v)} />
                <span className="w-8 text-left">{empathy}</span>
              </div>
            </div>
            <div className="flex flex-row justify-between items-center ">
              <h4 className="w-20 text-left">{t("interviewerSettings.rapport")}</h4>
              <div className="w-40 space-x-3 ml-3 flex justify-between items-center">
                <Slider value={[rapport]} max={1} step={0.1} onValueChange={([v]) => setRapport(v)} />
                <span className="w-8 text-left">{rapport}</span>
              </div>
            </div>
          </div>
          <div className=" mt-2 flex flex-col justify-start items-start">
            <div className="flex flex-row justify-between items-center mb-2">
              <h4 className="w-20 text-left">{t("interviewerSettings.exploration")}</h4>
              <div className="w-40 space-x-3 ml-3 flex justify-between items-center">
                <Slider value={[exploration]} max={1} step={0.1} onValueChange={([v]) => setExploration(v)} />
                <span className="w-8 text-left">{exploration}</span>
              </div>
            </div>
            <div className="flex flex-row justify-between items-center ">
              <h4 className="w-20 text-left">{t("interviewerSettings.speed")}</h4>
              <div className="w-40 space-x-3 ml-3 flex justify-between items-center">
                <Slider value={[speed]} max={1} step={0.1} onValueChange={([v]) => setSpeed(v)} />
                <span className="w-8 text-left">{speed}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default InterviewerDetailsModal;
