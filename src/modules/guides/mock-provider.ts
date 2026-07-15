import { humanizeLabel } from "./format";
import type { GuideGenerationProvider, GuideSectionInput, GuideSectionOutput } from "./types";

/**
 * Deterministic guide synthesis: templated markdown with the same [^claimId]
 * citation format the real provider emits, so the reader UI and citation
 * integrity checks are fully testable without a key.
 */
export class MockGuideProvider implements GuideGenerationProvider {
  readonly name = "mock-guide-v1";

  async synthesizeSection(input: GuideSectionInput): Promise<GuideSectionOutput> {
    const lines: string[] = [];
    const sourceCount = new Set(
      input.claims.map((claim) => claim.sourceId).filter(Boolean),
    ).size;
    lines.push(
      `What the collected sources say about ${input.topic.toLowerCase()} within ${input.pillar.name}, drawn from ${input.claims.length} claim${input.claims.length === 1 ? "" : "s"}${sourceCount > 0 ? ` across ${sourceCount} source${sourceCount === 1 ? "" : "s"}` : ""}.`,
    );
    lines.push("");

    for (const claim of input.claims) {
      const unknownAuthority = claim.authorityType === "unknown_or_self_reported";
      const attribution =
        claim.evidenceLevel === "official"
          ? "Official guidance states"
          : claim.evidenceLevel === "anecdotal"
            ? unknownAuthority
              ? "One account reports"
              : `One ${humanizeLabel(claim.authorityType)} reports`
            : claim.evidenceLevel === "community_consensus"
              ? "Community consensus holds"
              : unknownAuthority
                ? "The collected sources suggest"
                : `A ${humanizeLabel(claim.authorityType)} advises`;
      const hedge =
        claim.verificationStatus === "unverified" || claim.verificationStatus === "disputed"
          ? " (unverified)"
          : "";
      lines.push(`${attribution}: ${claim.canonicalText}${hedge} [^${claim.id}]`);
      lines.push("");
    }

    if (input.contradictions.length > 0) {
      lines.push(`> **Sources disagree.**`);
      for (const pair of input.contradictions) {
        lines.push(
          `> "${pair.a.canonicalText}" [^${pair.a.id}] versus "${pair.b.canonicalText}" [^${pair.b.id}]${pair.note ? ` — ${pair.note}` : ""} Which applies depends on the reader's circumstances; neither is settled.`,
        );
      }
      lines.push("");
    }

    return {
      bodyMarkdown: lines.join("\n").trim(),
      supportingClaimIds: input.claims.map((claim) => claim.id),
    };
  }
}
