import type { ExtractionResult } from "@/lib/schema/extraction";
import type { TranscriptInput } from "@/modules/transcript";
import type { SourceMetaForPrompt } from "./prompt";

export interface ExtractionInput {
  source: SourceMetaForPrompt;
  transcript: TranscriptInput;
}

export interface ExtractionProvider {
  readonly name: string;
  extract(input: ExtractionInput): Promise<ExtractionResult>;
}

/** Raised when the provider ran but produced unusable output. */
export class ExtractionFailedError extends Error {
  constructor(
    message: string,
    public readonly retriable: boolean,
  ) {
    super(message);
    this.name = "ExtractionFailedError";
  }
}
