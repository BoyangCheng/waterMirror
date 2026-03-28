import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useI18n } from "@/i18n";
import type { FeedbackData } from "@/types/response";
import React, { useState } from "react";

enum SatisfactionLevel {
  Positive = "\u{1F600}",
  Moderate = "\u{1F610}",
  Negative = "\u{1F614}",
}

interface FeedbackFormProps {
  onSubmit: (data: Omit<FeedbackData, "interview_id">) => void;
  email: string;
}

export function FeedbackForm({ onSubmit, email }: FeedbackFormProps) {
  const [satisfaction, setSatisfaction] = useState<SatisfactionLevel>(SatisfactionLevel.Moderate);
  const [feedback, setFeedback] = useState("");
  const { t } = useI18n();

  const handleSubmit = () => {
    if (satisfaction !== null || feedback.trim() !== "") {
      onSubmit({
        satisfaction: Object.values(SatisfactionLevel).indexOf(satisfaction),
        feedback,
        email,
      });
    }
  };

  return (
    <div className="p-4">
      <h3 className="text-lg font-semibold mb-4">{t("feedback.satisfied")}</h3>
      <div className="flex justify-center space-x-4 mb-4">
        {Object.values(SatisfactionLevel).map((emoji) => (
          <button
            type="button"
            key={emoji}
            className={`text-3xl ${satisfaction === emoji ? "border-2 border-indigo-600" : ""}`}
            onClick={() => setSatisfaction(emoji)}
          >
            {emoji}
          </button>
        ))}
      </div>
      <Textarea
        value={feedback}
        placeholder={t("feedback.placeholder")}
        className="mb-4"
        onChange={(e) => setFeedback(e.target.value)}
      />
      <Button
        disabled={satisfaction === null && feedback.trim() === ""}
        className="w-full bg-indigo-600 text-white"
        onClick={handleSubmit}
      >
        {t("feedback.submit")}
      </Button>
    </div>
  );
}
