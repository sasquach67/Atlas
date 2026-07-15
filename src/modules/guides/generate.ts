import type { Claim, Guide, GuideSection } from "@/lib/types";
import { getPillar, PILLARS } from "@/modules/taxonomy";
import type { Repositories } from "@/repositories/types";
import {
  extractCitedIds,
  GuideGenerationFailedError,
  type GuideGenerationProvider,
  type GuideSectionInput,
} from "./types";

/**
 * Hierarchical guide synthesis (spec Section 20): organized claims group into
 * pillar chapters and topic sections; each section is synthesized
 * independently so updates regenerate only what changed (stage 6).
 */

export const ATLAS_GUIDE_TITLE = "The Premed Atlas Guide";

function slugify(text: string): string {
  return (
    text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "general"
  );
}

export function sectionIdFor(pillarId: string, topic: string): string {
  return `sec-${pillarId}-${slugify(topic)}`;
}

interface SectionGroup {
  pillarId: string;
  topic: string;
  claims: Claim[];
}

function groupClaims(claims: Claim[]): SectionGroup[] {
  const groups = new Map<string, SectionGroup>();
  for (const claim of claims) {
    const topic = claim.topic.trim() || "General";
    const key = sectionIdFor(claim.pillarId, topic);
    const group = groups.get(key);
    if (group) group.claims.push(claim);
    else groups.set(key, { pillarId: claim.pillarId, topic, claims: [claim] });
  }
  const pillarOrder = new Map(PILLARS.map((pillar) => [pillar.id, pillar.sortOrder]));
  return Array.from(groups.values()).sort(
    (a, b) =>
      (pillarOrder.get(a.pillarId) ?? 99) - (pillarOrder.get(b.pillarId) ?? 99) ||
      a.topic.localeCompare(b.topic),
  );
}

function sectionInput(repos: Repositories, group: SectionGroup): GuideSectionInput {
  const idsInSection = new Set(group.claims.map((claim) => claim.id));
  const claimById = new Map(group.claims.map((claim) => [claim.id, claim]));
  const contradictions = repos.relationships
    .list()
    .filter(
      (rel) =>
        rel.relationshipType === "contradicts" &&
        rel.userConfirmed &&
        idsInSection.has(rel.fromClaimId) &&
        idsInSection.has(rel.toClaimId),
    )
    .map((rel) => ({
      a: claimById.get(rel.fromClaimId)!,
      b: claimById.get(rel.toClaimId)!,
      note: rel.note,
    }));
  const sourceIds = new Set(
    group.claims.map((claim) => claim.sourceId).filter((id): id is string => Boolean(id)),
  );
  const sources = repos.sources.list().filter((source) => sourceIds.has(source.id));
  return { pillar: getPillar(group.pillarId), topic: group.topic, claims: group.claims, contradictions, sources };
}

export interface GenerateResult {
  guide: Guide;
  sectionsGenerated: number;
  sectionsSkipped: number;
  failures: { sectionId: string; topic: string; message: string }[];
}

export async function generateAtlasGuide(
  repos: Repositories,
  provider: GuideGenerationProvider,
  options?: { onlyStale?: boolean },
): Promise<GenerateResult> {
  const organized = repos.claims.list({ status: "organized" });
  const groups = groupClaims(organized);
  const guide = repos.guides.upsertAtlasGuide({ title: ATLAS_GUIDE_TITLE });
  const existingSections = new Map(
    repos.guides.listSections(guide.id).map((section) => [section.id, section]),
  );

  let generated = 0;
  let skipped = 0;
  const failures: GenerateResult["failures"] = [];
  const keptIds: string[] = [];
  const now = new Date().toISOString();

  for (const [index, group] of groups.entries()) {
    const id = sectionIdFor(group.pillarId, group.topic);
    keptIds.push(id);
    const existing = existingSections.get(id);
    if (options?.onlyStale && existing && !existing.stale) {
      // Fresh section: keep body, just fix ordering.
      repos.guides.replaceSection({ ...existing, sortOrder: index });
      skipped++;
      continue;
    }
    try {
      const input = sectionInput(repos, group);
      const output = await provider.synthesizeSection(input);

      // Citation integrity: every [^id] must reference a claim in this
      // section — otherwise the model cited material it wasn't given.
      const allowed = new Set(group.claims.map((claim) => claim.id));
      const cited = extractCitedIds(output.bodyMarkdown);
      const invalid = cited.filter((cid) => !allowed.has(cid));
      if (invalid.length > 0) {
        throw new GuideGenerationFailedError(
          `Section cited unknown claims (${invalid.join(", ")}).`,
          true,
        );
      }
      if (cited.length === 0) {
        throw new GuideGenerationFailedError("Section has no citations.", true);
      }

      const section: GuideSection = {
        id,
        guideId: guide.id,
        pillarId: group.pillarId,
        topic: group.topic,
        sortOrder: index,
        bodyMarkdown: output.bodyMarkdown,
        supportingClaimIds: Array.from(new Set([...output.supportingClaimIds, ...cited])).filter(
          (cid) => allowed.has(cid),
        ),
        unresolvedContradictionIds: input.contradictions.flatMap((pair) => [pair.a.id, pair.b.id]),
        generatedAt: now,
        stale: false,
      };
      repos.guides.replaceSection(section);
      generated++;
    } catch (error) {
      failures.push({
        sectionId: id,
        topic: group.topic,
        message: error instanceof Error ? error.message : "Section synthesis failed.",
      });
      // Keep the previous body (if any) rather than losing it; leave it stale.
      if (existing) repos.guides.replaceSection({ ...existing, sortOrder: index, stale: true });
    }
  }

  repos.guides.deleteSectionsNotIn(guide.id, keptIds);
  const anyStale = repos.guides.listSections(guide.id).some((section) => section.stale);
  const updatedGuide = repos.guides.upsertAtlasGuide({
    version: guide.version + (generated > 0 ? 1 : 0),
    status: anyStale || failures.length > 0 ? "stale" : "current",
    generatedAt: now,
  });

  return { guide: updatedGuide, sectionsGenerated: generated, sectionsSkipped: skipped, failures };
}

/**
 * Marks the guide section covering a claim as outdated. Call whenever an
 * organized claim is edited, merged, rejected, or newly organized.
 */
export function markGuideStaleForClaim(
  repos: Repositories,
  claim: Pick<Claim, "pillarId" | "topic">,
): void {
  const guide = repos.guides.getAtlasGuide();
  if (!guide) return;
  const topic = claim.topic.trim() || "General";
  const changed = repos.guides.markSectionsStale(guide.id, claim.pillarId, topic);
  if (changed === 0) {
    // No section for this topic yet (newly organized topic) — the pillar
    // chapter is still affected, and generate(onlyStale) will add the section.
    repos.guides.markSectionsStale(guide.id, claim.pillarId);
    repos.guides.upsertAtlasGuide({ status: "stale" });
  }
}
