import type en from "./locales/en.json";

/** Supported locale codes */
export type Locale = "en" | "zh";

/** The shape of a full translation file (derived from the English source-of-truth) */
export type Messages = typeof en;

/**
 * Flatten a nested object type into dot-separated key paths.
 * e.g. { a: { b: string } } → "a.b"
 */
type FlattenKeys<T, Prefix extends string = ""> = T extends Record<string, unknown>
  ? {
      [K in keyof T & string]: T[K] extends Record<string, unknown>
        ? FlattenKeys<T[K], `${Prefix}${K}.`>
        : `${Prefix}${K}`;
    }[keyof T & string]
  : never;

/** All valid translation key paths (e.g. "common.save", "nav.interviews") */
export type TranslationKey = FlattenKeys<Messages>;
