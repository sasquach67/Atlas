import Anthropic, { APIConnectionError, APIError, RateLimitError } from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { formatTimestamp } from "@/lib/format";
import {
  GuideGenerationFailedError,
  type GuideGenerationProvider,
  type GuideSectionInput,
  type GuideSectionOutput,
} from "./types";

const DEFAULT_MODEL = "claude-opus-4-8";

const SectionOutputSchema = z.object({
  bodyMarkdown: z
    .string()
    .describe("Markdown body. Every paragraph ends with [^claimId] citations."),
  supportingClaimIds: z.array(z.string()),
});

const SYSTEM_PROMPT = `You write sections of "The Premed Atlas Guide" — a source-grounded synthesis of pre-med advice.

Non-negotiable rules:
- Synthesize ONLY from the provided claims. Never introduce facts, numbers, or advice that no claim supports.
- Every paragraph ends with citation markers of the form [^claimId] for each claim it draws on, using the exact claim ids provided. Do not invent ids.
- Never state an unverified or disputed claim as settled fact. Hedge and attribute: "one medical student reports…", "official AAMC guidance states…", "community consensus holds…".
- Numerical thresholds (hours, scores, costs) are never universal requirements unless the claim comes from an official organization — keep their non-universal framing.
- When contradictions are provided, include an explicit "**Sources disagree.**" blockquote paragraph explaining the conditions under which each side applies. Do not average disagreements away.
- Write 1-3 short paragraphs plus the disagreement callout when applicable. Calm, precise, editorial tone. No headings — the app renders the topic heading.
- supportingClaimIds lists every claim id you cited.`;

export class AnthropicGuideProvider implements GuideGenerationProvider {
  readonly name: string;
  private client: Anthropic;
  private model: string;

  constructor(apiKey: string, model = process.env.ATLAS_EXTRACTION_MODEL || DEFAULT_MODEL) {
    this.client = new Anthropic({ apiKey });
    this.model = model;
    this.name = `anthropic:${model}`;
  }

  async synthesizeSection(input: GuideSectionInput): Promise<GuideSectionOutput> {
    const sourcesById = new Map(input.sources.map((source) => [source.id, source]));
    const claimLines = input.claims
      .map((claim) => {
        const source = claim.sourceId ? sourcesById.get(claim.sourceId) : null;
        const cite = source
          ? ` | source: "${source.title}" (${source.platform ?? source.type})${
              claim.timestampStart != null ? ` @ ${formatTimestamp(claim.timestampStart)}` : ""
            }`
          : "";
        return `- id: ${claim.id} | type: ${claim.claimType} | evidence: ${claim.evidenceLevel} | verification: ${claim.verificationStatus} | authority: ${claim.authorityType} | scope: ${claim.scope.join(",")}${cite}\n  text: ${claim.canonicalText}`;
      })
      .join("\n");
    const contradictionLines =
      input.contradictions.length > 0
        ? input.contradictions
            .map((pair) => `- ${pair.a.id} vs ${pair.b.id}${pair.note ? ` (${pair.note})` : ""}`)
            .join("\n")
        : "none";

    let message;
    try {
      message = await this.client.messages.parse({
        model: this.model,
        max_tokens: 4000,
        system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
        messages: [
          {
            role: "user",
            content: `Write the section "${input.topic}" in the chapter "${input.pillar.name}".\n\n## Claims (your only allowed material)\n${claimLines}\n\n## Confirmed contradictions\n${contradictionLines}`,
          },
        ],
        output_config: { format: zodOutputFormat(SectionOutputSchema) },
      });
    } catch (error) {
      if (error instanceof RateLimitError) {
        throw new GuideGenerationFailedError(
          "The AI provider is rate-limiting requests. Wait a minute and retry.",
          true,
        );
      }
      if (error instanceof APIConnectionError) {
        throw new GuideGenerationFailedError(
          "Could not reach the AI provider. Check your connection and retry.",
          true,
        );
      }
      if (error instanceof APIError) {
        throw new GuideGenerationFailedError(
          `AI provider error (${error.status ?? "unknown"}): ${error.message}`,
          error.status !== undefined && error.status >= 500,
        );
      }
      throw error;
    }

    if (message.stop_reason === "refusal" || !message.parsed_output) {
      throw new GuideGenerationFailedError(
        "The model returned unusable output for this section. Retry.",
        true,
      );
    }
    return message.parsed_output;
  }
}
