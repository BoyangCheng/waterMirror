// Global setup for vitest.
// - Extends `expect` with @testing-library/jest-dom matchers (toBeInTheDocument, etc.)
// - Provides a TextEncoder/TextDecoder polyfill for older jsdom versions.

import "@testing-library/jest-dom/vitest";

// jsdom ships TextEncoder/TextDecoder in recent versions, but the TLV helpers
// in src/lib/volcengine-rtc.ts rely on them being globally available. Make
// sure that's true even on environments where jsdom strips them.
import { TextEncoder, TextDecoder } from "node:util";

if (typeof globalThis.TextEncoder === "undefined") {
  (globalThis as unknown as { TextEncoder: typeof TextEncoder }).TextEncoder = TextEncoder;
}
if (typeof globalThis.TextDecoder === "undefined") {
  (globalThis as unknown as { TextDecoder: typeof TextDecoder }).TextDecoder = TextDecoder;
}
