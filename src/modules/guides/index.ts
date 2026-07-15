import { AnthropicGuideProvider } from "./anthropic-provider";
import { MockGuideProvider } from "./mock-provider";
import type { GuideGenerationProvider } from "./types";

export {
  CITATION_PATTERN,
  extractCitedIds,
  GuideGenerationFailedError,
  type GuideGenerationProvider,
  type GuideSectionInput,
  type GuideSectionOutput,
} from "./types";
export { MockGuideProvider } from "./mock-provider";
export { AnthropicGuideProvider } from "./anthropic-provider";
export {
  ATLAS_GUIDE_TITLE,
  generateAtlasGuide,
  markGuideStaleForClaim,
  sectionIdFor,
  type GenerateResult,
} from "./generate";

/** Same selection rule as extraction: Claude with a key, deterministic mock otherwise. */
export function getGuideProvider(): GuideGenerationProvider {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (apiKey && process.env.ATLAS_FORCE_MOCK_AI !== "1") {
    return new AnthropicGuideProvider(apiKey);
  }
  return new MockGuideProvider();
}
