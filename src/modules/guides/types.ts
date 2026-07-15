import type { Claim, Source } from "@/lib/types";
import type { Pillar } from "@/modules/taxonomy";

export interface GuideSectionInput {
  pillar: Pillar;
  topic: string;
  claims: Claim[];
  contradictions: { a: Claim; b: Claim; note: string | null }[];
  sources: Source[];
}

export interface GuideSectionOutput {
  bodyMarkdown: string;
  supportingClaimIds: string[];
}

export interface GuideGenerationProvider {
  readonly name: string;
  synthesizeSection(input: GuideSectionInput): Promise<GuideSectionOutput>;
}

export class GuideGenerationFailedError extends Error {
  constructor(
    message: string,
    public readonly retriable: boolean,
  ) {
    super(message);
    this.name = "GuideGenerationFailedError";
  }
}

/** Matches [^claimId] citation markers (claim ids are UUIDs or seed slugs). */
export const CITATION_PATTERN = /\[\^([\w-]+)\]/g;

export function extractCitedIds(markdown: string): string[] {
  return Array.from(new Set(Array.from(markdown.matchAll(CITATION_PATTERN), (m) => m[1]!)));
}
