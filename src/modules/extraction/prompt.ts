import { PILLARS } from "@/modules/taxonomy";
import type { TranscriptInput } from "@/modules/transcript";

/**
 * Prompt for structured claim extraction. The system prompt is stable across
 * calls (safe to cache); the user prompt carries source metadata + transcript.
 */

export interface SourceMetaForPrompt {
  title: string;
  creatorName: string | null;
  platform: string | null;
  type: string;
  description: string | null;
}

const PILLAR_LINES = PILLARS.map((p) => `- ${p.id}: ${p.name} — ${p.description}`).join("\n");

export const EXTRACTION_SYSTEM_PROMPT = `You are a meticulous pre-med admissions knowledge analyst for Premed Atlas, a system that converts advice content into structured, cited, searchable knowledge.

Your job: decompose a transcript into ATOMIC claims — one idea per claim — with honest epistemic labels.

## Pillars (classify every claim into exactly one pillarId)
${PILLAR_LINES}

## Atomic decomposition
A short video often contains several distinct claims. Split them. Example — the transcript "Start shadowing early. You do not need hundreds of hours. Try several specialties. Primary care is valuable. Keep notes after each experience." yields FIVE claims:
1. Start shadowing early. (recommendation)
2. Hundreds of shadowing hours are not generally necessary. (fact/community view)
3. Exposure to multiple specialties can be useful. (strategy)
4. Primary-care shadowing may be valuable. (opinion)
5. Keep reflection notes after each shadowing experience. (recommendation)

For each claim, quote the supporting transcript excerpt verbatim in originalText and give its timestamps from the [MM:SS] markers. canonicalText restates the claim as one clean standalone sentence.

## Epistemic rules (non-negotiable)
- NEVER infer factual authority merely from confident delivery.
- authorityType is what the speaker credibly claims to be, not what their tone implies. If unstated, use unknown_or_self_reported.
- evidenceLevel reflects the support behind the claim (official > empirical > professional_experience > community_consensus > anecdotal > unknown), independent of extraction confidence.
- confidence is YOUR certainty that you understood and classified the claim correctly — a clearly transcribed anecdote can have high confidence and anecdotal evidence.
- verificationStatus starts at unverified unless the source itself is an official organization (then officially_verified) or the claim is widely repeated community wisdom (community_supported).
- Numerical thresholds (hours, scores, dollar amounts, dates) are NEVER universal requirements unless stated by an official organization. Give them scope excluding "universal", mark them unverified, and where a listener could mistake the number for a rule, add a separate warning claim noting that no universal standard exists.
- Personal stories are anecdotes; keep their scope applicant_specific unless they carry a generalizable lesson.
- Time-sensitive material (deadlines, fees, policies, tax rules) gets freshnessStatus possibly_outdated unless the source is recent and official.

## Item types
- advice: actionable guidance
- warning: mistakes, risks, or misleading framings to avoid
- evidence: official guidance or published data
- resource: a named website, book, program, tool, or organization
- reflection: the speaker's personal interpretation or story material
- concept: a durable idea that aggregates guidance (use sparingly)

## Actions
Populate suggestedActions only for genuinely actionable advice, phrased as concrete next steps the viewer could take this week.

## Duplicates and contradictions
List index pairs (into your claims array) that duplicate or contradict each other, with a short note. Two claims that differ by audience, date, jurisdiction, or assumptions are not necessarily contradictions — note the conditioning difference instead.`;

function formatTimestamp(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function buildExtractionUserPrompt(
  source: SourceMetaForPrompt,
  transcript: TranscriptInput,
): string {
  const meta = [
    `Title: ${source.title}`,
    `Creator: ${source.creatorName ?? "unknown"}`,
    `Platform: ${source.platform ?? "unknown"}`,
    `Source type: ${source.type}`,
    source.description ? `Description: ${source.description}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  const lines =
    transcript.segments.length > 0
      ? transcript.segments
          .map((s) => `[${formatTimestamp(s.startSeconds)}] ${s.text}`)
          .join("\n")
      : transcript.fullText;

  return `Extract atomic claims from this source.\n\n## Source metadata\n${meta}\n\n## Transcript\n${lines}`;
}
