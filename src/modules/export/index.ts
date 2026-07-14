import type { ActionItem, Claim, Relationship, Source, Transcript } from "@/lib/types";
import { formatTimestamp, humanize } from "@/lib/format";
import { PILLARS, type Pillar } from "@/modules/taxonomy";
import type { Repositories } from "@/repositories/types";

export type AtlasExportData = {
  exportedAt: string;
  version: 1;
  sources: Source[];
  transcripts: Transcript[];
  claims: Claim[];
  relationships: Relationship[];
  actions: ActionItem[];
  pillars: Pillar[];
};

export function buildExportData(
  repos: Repositories,
  exportedAt = new Date().toISOString(),
): AtlasExportData {
  const sources = repos.sources.list();
  return {
    exportedAt,
    version: 1,
    sources,
    transcripts: sources
      .map((source) => repos.transcripts.getBySourceId(source.id))
      .filter((transcript): transcript is Transcript => transcript !== null),
    claims: repos.claims.list(),
    relationships: repos.relationships.list(),
    actions: repos.actions.list(),
    pillars: PILLARS,
  };
}

export function serializeExportJson(data: AtlasExportData): string {
  return `${JSON.stringify(data, null, 2)}\n`;
}

function citation(claim: Claim, source: Source | undefined): string | null {
  if (!source) return null;
  const platform = source.platform ? ` (${source.platform})` : "";
  const timestamp =
    claim.timestampStart !== null ? ` @ ${formatTimestamp(claim.timestampStart)}` : "";
  return `-- *${source.title}*${platform}${timestamp}`;
}

export function serializeExportMarkdown(data: AtlasExportData): string {
  const sourcesById = new Map(data.sources.map((source) => [source.id, source]));
  const lines: string[] = ["# Premed Atlas Export", "", `Exported: ${data.exportedAt}`, ""];
  const activeClaims = data.claims.filter((claim) => claim.status !== "rejected");

  for (const pillar of [...data.pillars].sort((a, b) => a.sortOrder - b.sortOrder)) {
    const pillarClaims = activeClaims.filter((claim) => claim.pillarId === pillar.id);
    if (pillarClaims.length === 0) continue;
    lines.push(`## ${pillar.name}`, "");
    for (const claim of pillarClaims) {
      lines.push(`### ${claim.canonicalText}`, "");
      if (claim.originalText) {
        lines.push(`> ${claim.originalText}`, "");
      }
      lines.push(
        [
          humanize(claim.itemType),
          humanize(claim.scope.join(", ") || "unknown"),
          humanize(claim.authorityType),
          humanize(claim.evidenceLevel),
          humanize(claim.verificationStatus),
          humanize(claim.freshnessStatus),
          claim.confidence.toFixed(2),
        ].join(" | "),
      );
      const cite = citation(claim, claim.sourceId ? sourcesById.get(claim.sourceId) : undefined);
      if (cite) lines.push(cite);
      lines.push("");
    }
  }

  lines.push("## Actions", "");
  if (data.actions.length === 0) {
    lines.push("No actions.", "");
  } else {
    for (const action of data.actions) {
      lines.push(`- [${action.status === "completed" ? "x" : " "}] ${action.title}`);
      if (action.description) lines.push(`  ${action.description}`);
    }
    lines.push("");
  }

  lines.push("## Contradictions", "");
  const contradictions = data.relationships.filter(
    (relationship) => relationship.relationshipType === "contradicts",
  );
  if (contradictions.length === 0) {
    lines.push("No contradictions.", "");
  } else {
    const claimsById = new Map(data.claims.map((claim) => [claim.id, claim]));
    for (const relationship of contradictions) {
      lines.push(
        `- ${claimsById.get(relationship.fromClaimId)?.canonicalText ?? relationship.fromClaimId} <> ${claimsById.get(relationship.toClaimId)?.canonicalText ?? relationship.toClaimId}`,
      );
      if (relationship.note) lines.push(`  ${relationship.note}`);
    }
    lines.push("");
  }

  return `${lines.join("\n").trimEnd()}\n`;
}
