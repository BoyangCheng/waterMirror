"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import en from "./locales/en.json";
import zh from "./locales/zh.json";
import type { Locale, Messages, TranslationKey } from "./types";

// ---------------------------------------------------------------------------
// Locale ↔ Messages map
// ---------------------------------------------------------------------------
const messages: Record<Locale, Messages> = { en, zh } as Record<Locale, Messages>;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const STORAGE_KEY = "watermirror-locale";
const DEFAULT_LOCALE: Locale = "zh";

/** Resolve a dot-separated key against a nested object, returning the leaf string. */
function resolve(obj: unknown, path: string): string | undefined {
  let current: unknown = obj;
  for (const segment of path.split(".")) {
    if (current == null || typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[segment];
  }
  return typeof current === "string" ? current : undefined;
}

/** Read persisted locale (safe for SSR — returns default when `window` is absent). */
function readPersistedLocale(): Locale {
  if (typeof window === "undefined") return DEFAULT_LOCALE;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "en" || stored === "zh") return stored;
  } catch {
    // localStorage not available (e.g. private browsing with storage disabled)
  }
  return DEFAULT_LOCALE;
}

// ---------------------------------------------------------------------------
// Context value type
// ---------------------------------------------------------------------------
export interface I18nContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: TranslationKey, params?: Record<string, string | number>) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------
export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(DEFAULT_LOCALE);
  const [hydrated, setHydrated] = useState(false);

  // After first client render, read the persisted locale.
  // This two-phase approach avoids hydration mismatch:
  //   Server always renders with DEFAULT_LOCALE ("en"),
  //   then client immediately updates if stored locale differs.
  useEffect(() => {
    setLocaleState(readPersistedLocale());
    setHydrated(true);
  }, []);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // ignore
    }
    // Update <html lang="..."> for accessibility / SEO
    document.documentElement.lang = next;
  }, []);

  const t = useCallback(
    (key: TranslationKey, params?: Record<string, string | number>): string => {
      // Try the active locale first, fall back to English
      let value = resolve(messages[locale], key) ?? resolve(messages[DEFAULT_LOCALE], key) ?? key;

      // Simple interpolation: replace {{paramName}} tokens
      if (params) {
        for (const [paramKey, paramValue] of Object.entries(params)) {
          value = value.replace(new RegExp(`\\{\\{${paramKey}\\}\\}`, "g"), String(paramValue));
        }
      }

      return value;
    },
    [locale],
  );

  const value = useMemo<I18nContextValue>(
    () => ({ locale, setLocale, t }),
    [locale, setLocale, t],
  );

  // Suppress hydration flash: render nothing extra until client is mounted.
  // The children still render so layout doesn't shift — only the `locale`
  // state is deferred, and all text defaults to "en" on first paint anyway.
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------
export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    throw new Error("useI18n must be used within an <I18nProvider>");
  }
  return ctx;
}
