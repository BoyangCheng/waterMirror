"use client";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { useInterviewers } from "@/contexts/interviewers.context";
import { useI18n } from "@/i18n";
import { FEMALE_AVATARS, MALE_AVATARS, VOLCENGINE_VOICES } from "@/lib/constants";
import { Loader2 } from "lucide-react";
import Image from "next/image";
import { useState } from "react";
import { toast } from "sonner";

interface Props {
  onClose: () => void;
}

export default function CreateInterviewerModal({ onClose }: Props) {
  const { t, locale } = useI18n();
  const { createInterviewer } = useInterviewers();

  const [name, setName] = useState("");
  // 默认女声 + Lisa（FEMALE_AVATARS[0]）
  const [agentId, setAgentId] = useState<string>(VOLCENGINE_VOICES[0].id);
  const [selectedImage, setSelectedImage] = useState(FEMALE_AVATARS[0]);

  // 当前性别决定可选头像列表；首项作为切换性别时的默认
  const isMaleVoice = agentId === VOLCENGINE_VOICES[1].id;
  const allowedAvatars = isMaleVoice ? MALE_AVATARS : FEMALE_AVATARS;

  // 切换声音时，如果当前头像不在新性别的允许列表里，自动跳到该性别的第一个（Bob/Lisa）
  const handleVoiceChange = (voiceId: string) => {
    setAgentId(voiceId);
    const isNewMale = voiceId === VOLCENGINE_VOICES[1].id;
    const newAllowed = isNewMale ? MALE_AVATARS : FEMALE_AVATARS;
    if (!newAllowed.includes(selectedImage)) {
      setSelectedImage(newAllowed[0]);
    }
  };
  const [empathy, setEmpathy] = useState(7);
  const [rapport, setRapport] = useState(7);
  const [exploration, setExploration] = useState(7);
  const [speed, setSpeed] = useState(5);
  const [loading, setLoading] = useState(false);
  const [previewingId, setPreviewingId] = useState<string | null>(null);

  const handlePreview = async (voiceId: string) => {
    if (previewingId) return;
    setPreviewingId(voiceId);
    try {
      const res = await fetch("/api/voice-preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ voice_type: voiceId }),
      });
      if (!res.ok) throw new Error("preview failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audio.onended = () => { URL.revokeObjectURL(url); setPreviewingId(null); };
      audio.onerror = () => { setPreviewingId(null); };
      audio.play();
    } catch {
      setPreviewingId(null);
    }
  };

  // Auto-generate description based on voice gender and locale（用上面已定义的 isMaleVoice）
  const description = isMaleVoice
    ? t("interviewers.bob.description" as any)
    : t("interviewers.lisa.description" as any);

  const handleSubmit = async () => {
    if (!name.trim()) return;
    setLoading(true);
    try {
      await createInterviewer({
        name: name.trim(),
        description,
        image: selectedImage,
        agent_id: agentId,
        empathy,
        rapport,
        exploration,
        speed,
      });
      toast.success(t("interviewerSettings.createSuccess"), { position: "bottom-right" });
      onClose();
    } catch {
      toast.error(t("interviewerSettings.createFailed"), { position: "bottom-right" });
    }
    setLoading(false);
  };

  const inputClass =
    "w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

  return (
    <div className="w-[36rem] flex flex-col gap-5">
      <h2 className="text-xl font-semibold">{t("interviewerSettings.createNew")}</h2>

      {/* Name */}
      <div className="flex flex-col gap-1">
        <Label>{t("interviewerSettings.name")}</Label>
        <input
          className={inputClass}
          placeholder={t("interviewerSettings.namePlaceholder")}
          value={name}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
        />
      </div>

      {/* Avatar selection */}
      <div className="flex flex-col gap-2">
        <Label>{t("interviewerSettings.selectAvatar")}</Label>
        <div className="flex flex-row flex-wrap gap-3">
          {/* 只渲染当前性别允许的头像（女声→Lisa/liu；男声→Bob/bo） */}
          {allowedAvatars.map((src) => (
            <div
              key={src}
              onClick={() => setSelectedImage(src)}
              className={`cursor-pointer rounded-xl overflow-hidden border-4 transition-colors ${
                selectedImage === src ? "border-indigo-500" : "border-transparent"
              }`}
            >
              <Image src={src} alt="avatar" width={72} height={72} className="h-18 w-16 object-cover object-center" />
            </div>
          ))}
        </div>
      </div>

      {/* Voice type */}
      <div className="flex flex-col gap-1">
        <Label>{t("interviewerSettings.voiceType")}</Label>
        <div className="flex gap-3">
          {VOLCENGINE_VOICES.map((v) => (
            <div key={v.id} className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => handleVoiceChange(v.id)}
                className={`px-4 py-2 rounded-lg border text-sm transition-colors ${
                  agentId === v.id
                    ? "border-indigo-500 bg-indigo-50 text-indigo-700 font-medium"
                    : "border-gray-200 hover:border-gray-400"
                }`}
              >
                {t(`interviewerSettings.${v.label}` as any)}
              </button>
              <button
                type="button"
                title="试听"
                disabled={previewingId !== null}
                onClick={() => handlePreview(v.id)}
                className="text-indigo-500 hover:text-indigo-700 disabled:opacity-40 text-lg leading-none"
              >
                {previewingId === v.id ? "⏳" : "▶"}
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Sliders */}
      <div className="grid grid-cols-2 gap-x-10 gap-y-3">
        {[
          { key: "empathy", value: empathy, setter: setEmpathy },
          { key: "rapport", value: rapport, setter: setRapport },
          { key: "exploration", value: exploration, setter: setExploration },
          { key: "speed", value: speed, setter: setSpeed },
        ].map(({ key, value, setter }) => (
          <div key={key} className="flex flex-col gap-1">
            <div className="flex justify-between text-sm">
              <span>{t(`interviewerSettings.${key}` as any)}</span>
              <span className="text-gray-500">{value}/10</span>
            </div>
            <Slider
              min={1}
              max={10}
              step={1}
              value={[value]}
              onValueChange={([v]) => setter(v)}
            />
          </div>
        ))}
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-3 mt-2">
        <Button variant="outline" onClick={onClose} disabled={loading}>
          {t("common.cancel")}
        </Button>
        <Button onClick={handleSubmit} disabled={loading || !name.trim()}>
          {loading ? <Loader2 size={16} className="animate-spin mr-2" /> : null}
          {t("interviewerSettings.createNew")}
        </Button>
      </div>
    </div>
  );
}
