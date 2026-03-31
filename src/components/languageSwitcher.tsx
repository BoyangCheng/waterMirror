"use client";

import { useI18n } from "@/i18n";
import type { Locale } from "@/i18n";
import { GlobeIcon } from "lucide-react";
import React, { useEffect, useRef, useState } from "react";

const LOCALES: { value: Locale; label: string }[] = [
  { value: "zh", label: "中文" },
  { value: "en", label: "English" },
];

export default function LanguageSwitcher() {
  const { locale, setLocale } = useI18n();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const current = LOCALES.find((l) => l.value === locale) ?? LOCALES[0];

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-sm font-medium text-slate-700 hover:bg-slate-200 transition-colors"
        aria-label="Switch language"
      >
        <GlobeIcon className="h-4 w-4" />
        <span>{current.label}</span>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 w-28 bg-white border border-gray-100 rounded-lg shadow-lg py-1 z-50">
          {LOCALES.map((l) => (
            <button
              key={l.value}
              type="button"
              onClick={() => { setLocale(l.value); setOpen(false); }}
              className={`flex items-center w-full px-4 py-2 text-sm transition-colors hover:bg-slate-50 ${
                locale === l.value ? "text-indigo-600 font-medium" : "text-gray-700"
              }`}
            >
              {l.value === locale && <span className="mr-1.5">✓</span>}
              {l.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
