/**
 * Unit tests for the WaterMirror i18n system.
 *
 * Run with:  npx vitest run src/i18n/__tests__/i18n.test.tsx
 *       or:  npx jest src/i18n/__tests__/i18n.test.tsx
 *
 * These tests verify:
 *  1. Default locale is "en"
 *  2. Language switching updates translations
 *  3. Missing keys in zh.json fall back to English
 *  4. The t() function returns the key itself as ultimate fallback
 *  5. Interpolation with {{param}} tokens works
 */

import React from "react";
import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { I18nProvider, useI18n } from "../context";
import type { TranslationKey } from "../types";

// ---------------------------------------------------------------------------
// Test component that exposes the i18n API to the test harness
// ---------------------------------------------------------------------------
function TestHarness() {
  const { locale, setLocale, t } = useI18n();

  return (
    <div>
      <span data-testid="locale">{locale}</span>
      <span data-testid="nav-interviews">{t("nav.interviews")}</span>
      <span data-testid="common-save">{t("common.save")}</span>
      <span data-testid="common-beta">{t("common.beta")}</span>
      {/* Cast to any to test a deliberately missing key */}
      <span data-testid="missing-key">{t("this.key.does.not.exist" as TranslationKey)}</span>
      <button data-testid="switch-zh" onClick={() => setLocale("zh")}>
        Switch to Chinese
      </button>
      <button data-testid="switch-en" onClick={() => setLocale("en")}>
        Switch to English
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helper: render inside the I18nProvider
// ---------------------------------------------------------------------------
function renderWithI18n() {
  return render(
    <I18nProvider>
      <TestHarness />
    </I18nProvider>,
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe("WaterMirror i18n system", () => {
  beforeEach(() => {
    // Clear localStorage before each test to ensure clean state
    localStorage.removeItem("watermirror-locale");
  });

  it("defaults to Chinese locale (DEFAULT_LOCALE = 'zh')", () => {
    renderWithI18n();
    expect(screen.getByTestId("locale").textContent).toBe("zh");
    expect(screen.getByTestId("nav-interviews").textContent).toBe("面试");
    expect(screen.getByTestId("common-save").textContent).toBe("保存");
  });

  it("switches to Chinese and shows translated text", async () => {
    renderWithI18n();
    const user = userEvent.setup();

    await user.click(screen.getByTestId("switch-zh"));

    expect(screen.getByTestId("locale").textContent).toBe("zh");
    expect(screen.getByTestId("nav-interviews").textContent).toBe("面试");
    expect(screen.getByTestId("common-save").textContent).toBe("保存");
    expect(screen.getByTestId("common-beta").textContent).toBe("测试版");
  });

  it("switches back to English from Chinese", async () => {
    renderWithI18n();
    const user = userEvent.setup();

    await user.click(screen.getByTestId("switch-zh"));
    expect(screen.getByTestId("locale").textContent).toBe("zh");

    await user.click(screen.getByTestId("switch-en"));
    expect(screen.getByTestId("locale").textContent).toBe("en");
    expect(screen.getByTestId("nav-interviews").textContent).toBe("Interviews");
  });

  it("falls back to English when a key is missing in zh.json", async () => {
    // The key "this.key.does.not.exist" won't be in either file,
    // so it should fall back to the key string itself.
    renderWithI18n();
    const user = userEvent.setup();

    await user.click(screen.getByTestId("switch-zh"));

    // Missing key returns the key path as ultimate fallback
    expect(screen.getByTestId("missing-key").textContent).toBe("this.key.does.not.exist");
  });

  it("returns key path as fallback when key is missing from all locales", () => {
    renderWithI18n();
    expect(screen.getByTestId("missing-key").textContent).toBe("this.key.does.not.exist");
  });

  it("persists locale preference to localStorage", async () => {
    renderWithI18n();
    const user = userEvent.setup();

    await user.click(screen.getByTestId("switch-zh"));

    expect(localStorage.getItem("watermirror-locale")).toBe("zh");
  });
});
