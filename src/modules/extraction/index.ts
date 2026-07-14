import { AnthropicExtractionProvider } from "./anthropic-provider";
import { MockExtractionProvider } from "./mock-provider";
import type { ExtractionProvider } from "./types";

export type { ExtractionInput, ExtractionProvider } from "./types";
export { ExtractionFailedError } from "./types";
export { MockExtractionProvider } from "./mock-provider";
export { AnthropicExtractionProvider } from "./anthropic-provider";

/**
 * Provider selection (spec E.33): real Claude when ANTHROPIC_API_KEY is set,
 * deterministic mock otherwise. ATLAS_FORCE_MOCK_AI=1 pins the mock even with
 * a key present (used by tests and e2e).
 */
export function getExtractionProvider(): ExtractionProvider {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (apiKey && process.env.ATLAS_FORCE_MOCK_AI !== "1") {
    return new AnthropicExtractionProvider(apiKey);
  }
  return new MockExtractionProvider();
}

/** Surfaced in /settings so the user can see which AI path is active. */
export function describeAiStatus(): {
  provider: "anthropic" | "mock";
  detail: string;
} {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (apiKey && process.env.ATLAS_FORCE_MOCK_AI !== "1") {
    return {
      provider: "anthropic",
      detail: `Claude API key detected — claims are extracted by ${
        process.env.ATLAS_EXTRACTION_MODEL || "claude-opus-4-8"
      }.`,
    };
  }
  return {
    provider: "mock",
    detail: apiKey
      ? "ATLAS_FORCE_MOCK_AI=1 — deterministic mock extraction is pinned on."
      : "No ANTHROPIC_API_KEY set — using deterministic mock extraction. Add a key to .env.local for real AI extraction.",
  };
}
