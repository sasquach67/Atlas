import Anthropic, { APIConnectionError, APIError, RateLimitError } from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import {
  ExtractionResultSchema,
  sanitizeExtractionResult,
  type ExtractionResult,
} from "@/lib/schema/extraction";
import { buildExtractionUserPrompt, EXTRACTION_SYSTEM_PROMPT } from "./prompt";
import { ExtractionFailedError, type ExtractionInput, type ExtractionProvider } from "./types";

const DEFAULT_MODEL = "claude-opus-4-8";

/**
 * Real Claude extraction via structured outputs: messages.parse +
 * zodOutputFormat guarantee the response matches ExtractionResultSchema or
 * the call fails loudly — invalid output never reaches the database.
 */
export class AnthropicExtractionProvider implements ExtractionProvider {
  readonly name: string;
  private client: Anthropic;
  private model: string;

  constructor(apiKey: string, model = process.env.ATLAS_EXTRACTION_MODEL || DEFAULT_MODEL) {
    this.client = new Anthropic({ apiKey });
    this.model = model;
    this.name = `anthropic:${model}`;
  }

  async extract(input: ExtractionInput): Promise<ExtractionResult> {
    let message;
    try {
      message = await this.client.messages.parse({
        model: this.model,
        max_tokens: 16_000,
        system: [
          {
            type: "text",
            text: EXTRACTION_SYSTEM_PROMPT,
            cache_control: { type: "ephemeral" },
          },
        ],
        messages: [
          { role: "user", content: buildExtractionUserPrompt(input.source, input.transcript) },
        ],
        output_config: { format: zodOutputFormat(ExtractionResultSchema) },
      });
    } catch (error) {
      if (error instanceof RateLimitError) {
        throw new ExtractionFailedError(
          "The AI provider is rate-limiting requests. Wait a minute and retry.",
          true,
        );
      }
      if (error instanceof APIConnectionError) {
        throw new ExtractionFailedError(
          "Could not reach the AI provider. Check your connection and retry.",
          true,
        );
      }
      if (error instanceof APIError) {
        throw new ExtractionFailedError(
          `AI provider error (${error.status ?? "unknown"}): ${error.message}`,
          error.status !== undefined && error.status >= 500,
        );
      }
      throw error;
    }

    if (message.stop_reason === "refusal") {
      throw new ExtractionFailedError(
        "The model declined to process this content.",
        false,
      );
    }
    if (message.stop_reason === "max_tokens") {
      throw new ExtractionFailedError(
        "The source is too long for a single extraction pass. Trim the transcript and retry.",
        false,
      );
    }
    if (!message.parsed_output) {
      throw new ExtractionFailedError(
        "The model returned output that did not match the extraction schema. Retry.",
        true,
      );
    }
    return sanitizeExtractionResult(message.parsed_output);
  }
}
