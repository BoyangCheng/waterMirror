"use client";

import { useI18n } from "@/i18n";
import type { Locale } from "@/i18n";
import { GlobeIcon } from "lucide-react";
import React from "react";

const LOCALE_LABELS: Record<Locale, string> = {
  en: "EN",
  zh: "中文",
};

/**
 * Compact language toggle button.
 * Cycles between supported locales on click.
 */
export default function LanguageSwitcher() {
  const { locale, setLocale } = useI18n();

  const toggle = () => {
    setLocale(locale === "en" ? "zh" : "en");
  };

  return (
    <button
      type="button"
      onClick={toggle}
      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-sm font-medium text-slate-700 hover:bg-slate-200 transition-colors"
      aria-label="Switch language"
    >
      <GlobeIcon className="h-4 w-4" />
      <span>{LOCALE_LABELS[locale]}</span>
    </button>
  );
}
