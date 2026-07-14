import { z } from "zod";
import {
  AUTHORITY_TYPES,
  CLAIM_TYPES,
  EVIDENCE_LEVELS,
  FRESHNESS_STATUSES,
  ITEM_TYPES,
  SCOPES,
  VERIFICATION_STATUSES,
} from "@/lib/types";
import { PILLAR_IDS } from "@/modules/taxonomy";

/**
 * The single source of truth for AI extraction output. Both the Anthropic
 * provider (via zodOutputFormat) and the mock provider emit this shape, and
 * the ingestion pipeline maps it onto Claim rows.
 */

export const PillarIdSchema = z.enum(PILLAR_IDS as [string, ...string[]]);

export const ExtractedClaimSchema = z.object({
  canonicalText: z
    .string()
    .describe("Normalized, standalone restatement of the claim in one sentence."),
  originalText: z
    .string()
    .describe("Verbatim excerpt from the transcript that this claim came from."),
  timestampStart: z
    .number()
    .nullable()
    .describe("Start of the supporting excerpt in seconds, null if unknown."),
  timestampEnd: z.number().nullable().describe("End of the supporting excerpt in seconds."),
  itemType: z
    .enum(ITEM_TYPES)
    .describe("advice | warning | evidence | resource | reflection | concept"),
  claimType: z.enum(CLAIM_TYPES),
  scope: z
    .array(z.enum(SCOPES))
    .describe("Who the claim actually applies to. Numerical thresholds are rarely universal."),
  authorityType: z
    .enum(AUTHORITY_TYPES)
    .describe("Speaker's claimed role. Never upgrade based on confident delivery."),
  evidenceLevel: z.enum(EVIDENCE_LEVELS),
  verificationStatus: z.enum(VERIFICATION_STATUSES),
  freshnessStatus: z.enum(FRESHNESS_STATUSES),
  confidence: z
    .number()
    .describe("0-1: how confident the extractor is that it understood and classified correctly."),
  pillarId: PillarIdSchema,
  topic: z.string().describe("Short subtopic label within the pillar, e.g. 'Study timeline'."),
  tags: z.array(z.string()),
  suggestedActions: z
    .array(z.object({ title: z.string(), description: z.string() }))
    .describe("Concrete next steps, only for genuinely actionable advice."),
});

export const ExtractionPairSchema = z.object({
  claimIndexA: z.number(),
  claimIndexB: z.number(),
  note: z.string(),
});

export const ExtractionResultSchema = z.object({
  suggestedTitle: z.string(),
  sourceSummary: z.string(),
  claims: z.array(ExtractedClaimSchema),
  possibleDuplicates: z.array(ExtractionPairSchema),
  possibleContradictions: z.array(ExtractionPairSchema),
});

export type ExtractedClaim = z.infer<typeof ExtractedClaimSchema>;
export type ExtractionResult = z.infer<typeof ExtractionResultSchema>;

/** Clamp values the model can't express via schema constraints. */
export function sanitizeExtractionResult(result: ExtractionResult): ExtractionResult {
  return {
    ...result,
    claims: result.claims.map((claim) => ({
      ...claim,
      confidence: Math.min(1, Math.max(0, claim.confidence)),
      scope: claim.scope.length > 0 ? claim.scope : ["unknown"],
    })),
    possibleDuplicates: result.possibleDuplicates.filter(
      (p) => p.claimIndexA >= 0 && p.claimIndexA < result.claims.length && p.claimIndexB >= 0 && p.claimIndexB < result.claims.length && p.claimIndexA !== p.claimIndexB,
    ),
    possibleContradictions: result.possibleContradictions.filter(
      (p) => p.claimIndexA >= 0 && p.claimIndexA < result.claims.length && p.claimIndexB >= 0 && p.claimIndexB < result.claims.length && p.claimIndexA !== p.claimIndexB,
    ),
  };
}
