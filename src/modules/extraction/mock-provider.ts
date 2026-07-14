import type { ExtractionProvider, ExtractionInput } from "./types";
import {
  sanitizeExtractionResult,
  type ExtractedClaim,
  type ExtractionResult,
} from "@/lib/schema/extraction";
import { classifyByKeywords } from "@/modules/taxonomy";
import { djb2Hash } from "@/modules/transcript";
import type { ClaimType, ItemType, Scope } from "@/lib/types";

/**
 * Deterministic extraction used when no ANTHROPIC_API_KEY is set and by all
 * tests/CI. Same input → same output, always schema-valid.
 *
 * Two layers:
 *  1. fixture match — the "500 clinical hours" demo transcript returns a
 *     hand-written fixture exercising every epistemic surface;
 *  2. heuristic sentence classification for arbitrary pasted text.
 */

const FIXTURE_MARKER = "500 clinical hours";

function fixtureFor500Hours(input: ExtractionInput): ExtractionResult {
  const seg = (needle: string) =>
    input.transcript.segments.find((s) => s.text.toLowerCase().includes(needle));
  const hoursSeg = seg("500 clinical hours");
  const contactSeg = seg("patient contact");
  const journalSeg = seg("journal");
  return {
    suggestedTitle: "How many clinical hours you actually need",
    sourceSummary:
      "A second-year medical student argues 500 clinical hours is the practical floor for applying, stresses that only real patient contact counts, and recommends journaling after every shift.",
    claims: [
      {
        canonicalText: "Applicants need at least 500 clinical hours to apply.",
        originalText:
          hoursSeg?.text ?? "You need at least 500 clinical hours to apply. That's the floor.",
        timestampStart: hoursSeg?.startSeconds ?? null,
        timestampEnd: hoursSeg?.endSeconds ?? null,
        itemType: "advice",
        claimType: "recommendation",
        scope: ["applicant_specific"],
        authorityType: "medical_student",
        evidenceLevel: "anecdotal",
        verificationStatus: "unverified",
        freshnessStatus: "probably_current",
        confidence: 0.55,
        pillarId: "clinical-experience",
        topic: "Clinical hour thresholds",
        tags: ["numerical", "hours"],
        suggestedActions: [
          {
            title: "Audit current clinical hours",
            description:
              "Evaluate hours so far for quality, direct patient interaction, continuity, and reflection — not just the count.",
          },
        ],
      },
      {
        canonicalText:
          "No universal minimum clinical hour requirement exists; treat quoted thresholds as one person's heuristic.",
        originalText:
          hoursSeg?.text ?? "You need at least 500 clinical hours to apply.",
        timestampStart: hoursSeg?.startSeconds ?? null,
        timestampEnd: hoursSeg?.endSeconds ?? null,
        itemType: "warning",
        claimType: "warning",
        scope: ["universal"],
        authorityType: "unknown_or_self_reported",
        evidenceLevel: "unknown",
        verificationStatus: "unverified",
        freshnessStatus: "current",
        confidence: 0.7,
        pillarId: "clinical-experience",
        topic: "Clinical hour thresholds",
        tags: ["numerical", "no-official-standard"],
        suggestedActions: [],
      },
      {
        canonicalText: "Clinical experience must involve real patient contact to count.",
        originalText:
          contactSeg?.text ??
          "It has to be real patient contact. Stocking shelves in a hospital gift shop does not count.",
        timestampStart: contactSeg?.startSeconds ?? null,
        timestampEnd: contactSeg?.endSeconds ?? null,
        itemType: "concept",
        claimType: "strategy",
        scope: ["universal"],
        authorityType: "medical_student",
        evidenceLevel: "community_consensus",
        verificationStatus: "community_supported",
        freshnessStatus: "current",
        confidence: 0.82,
        pillarId: "clinical-experience",
        topic: "Clinical depth and continuity",
        tags: ["quality-over-quantity"],
        suggestedActions: [],
      },
      {
        canonicalText: "Keep a reflection journal after every clinical shift.",
        originalText:
          journalSeg?.text ??
          "Keep a journal after every shift — you will forget the patients that mattered.",
        timestampStart: journalSeg?.startSeconds ?? null,
        timestampEnd: journalSeg?.endSeconds ?? null,
        itemType: "advice",
        claimType: "recommendation",
        scope: ["universal"],
        authorityType: "medical_student",
        evidenceLevel: "professional_experience",
        verificationStatus: "unverified",
        freshnessStatus: "current",
        confidence: 0.85,
        pillarId: "clinical-experience",
        topic: "Reflection habits",
        tags: ["reflection", "story-bank"],
        suggestedActions: [
          {
            title: "Start a post-shift reflection journal",
            description: "Two sentences per shift: what happened, why it mattered.",
          },
        ],
      },
    ],
    possibleDuplicates: [],
    possibleContradictions: [{ claimIndexA: 0, claimIndexB: 1, note: "The threshold claim and the no-universal-minimum warning qualify each other." }],
  };
}

const NUMERIC_THRESHOLD = /\b(at least|minimum|need|must have|require[sd]?)\b[^.!?]*?\d/i;
const HAS_NUMBER = /\d[\d,.]*\s*(hours?|points?|months?|years?|%|\$|gpa|score)/i;
const WARNING_WORDS = /\b(don'?t|do not|avoid|never|mistake|stop|worst|red flag)\b/i;
const FIRST_PERSON = /\b(i |i'|my |me |we )/i;
const RECOMMEND_WORDS = /\b(should|recommend|make sure|prioritize|try to|start|ask|keep|pick|look into)\b/i;

function classifySentence(sentence: string): { itemType: ItemType; claimType: ClaimType } {
  if (WARNING_WORDS.test(sentence)) return { itemType: "warning", claimType: "warning" };
  if (FIRST_PERSON.test(sentence) && !RECOMMEND_WORDS.test(sentence))
    return { itemType: "advice", claimType: "anecdote" };
  if (HAS_NUMBER.test(sentence)) return { itemType: "advice", claimType: "recommendation" };
  if (RECOMMEND_WORDS.test(sentence)) return { itemType: "advice", claimType: "recommendation" };
  return { itemType: "advice", claimType: "opinion" };
}

function cleanCanonical(sentence: string): string {
  const cleaned = sentence
    .replace(/^\s*(okay|so|honestly|look|real talk|listen)[,:]?\s+/i, "")
    .trim();
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

export class MockExtractionProvider implements ExtractionProvider {
  readonly name = "mock-extractor-v1";

  async extract(input: ExtractionInput): Promise<ExtractionResult> {
    if (input.transcript.fullText.toLowerCase().includes(FIXTURE_MARKER)) {
      return sanitizeExtractionResult(fixtureFor500Hours(input));
    }

    const fallbackPillar =
      classifyByKeywords(input.transcript.fullText) ??
      classifyByKeywords(input.source.title);

    const sentences = input.transcript.fullText
      .replace(/\s+/g, " ")
      .split(/(?<=[.!?])\s+/)
      .map((s) => s.trim())
      .filter((s) => s.split(" ").length >= 4)
      .slice(0, 12);

    const claims: ExtractedClaim[] = sentences.map((sentence) => {
      const { itemType, claimType } = classifySentence(sentence);
      const pillar = classifyByKeywords(sentence) ?? fallbackPillar;
      const segment = input.transcript.segments.find((s) =>
        s.text.includes(sentence.slice(0, Math.min(40, sentence.length))),
      );
      const hash = djb2Hash(sentence);
      const numeric = HAS_NUMBER.test(sentence);
      const isAnecdote = claimType === "anecdote";
      return {
        canonicalText: cleanCanonical(sentence),
        originalText: sentence,
        timestampStart: segment?.startSeconds ?? null,
        timestampEnd: segment?.endSeconds ?? null,
        itemType,
        claimType,
        scope: (numeric || isAnecdote ? ["applicant_specific"] : ["unknown"]) as Scope[],
        authorityType: "unknown_or_self_reported",
        evidenceLevel: isAnecdote ? "anecdotal" : "unknown",
        verificationStatus: "unverified",
        freshnessStatus: "unknown",
        confidence: 0.5 + (hash % 40) / 100,
        pillarId: pillar?.id ?? "north-star",
        topic: pillar?.shortName ?? "General",
        tags: numeric ? ["numerical"] : [],
        suggestedActions: [],
      };
    });

    // Numeric thresholds get a paired warning claim (spec E.16).
    const thresholdIndex = sentences.findIndex((s) => NUMERIC_THRESHOLD.test(s));
    if (thresholdIndex >= 0) {
      const base = claims[thresholdIndex]!;
      claims.push({
        ...base,
        canonicalText:
          "Quoted numerical thresholds are one person's heuristic; no universal official standard is established by this source.",
        itemType: "warning",
        claimType: "warning",
        scope: ["universal"],
        evidenceLevel: "unknown",
        confidence: 0.65,
        tags: ["numerical", "no-official-standard"],
        suggestedActions: [],
      });
    }

    return sanitizeExtractionResult({
      suggestedTitle: input.source.title,
      sourceSummary:
        claims.length > 0
          ? `${claims.length} claims extracted heuristically (mock provider).`
          : "No extractable claims found (mock provider).",
      claims,
      possibleDuplicates: [],
      possibleContradictions: [],
    });
  }
}
