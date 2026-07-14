import type { Edge, Node } from "@xyflow/react";
import type {
  Claim,
  ClaimSearchFilters,
  NodePosition,
  Relationship,
  Source,
} from "@/lib/types";
import { PILLARS } from "@/modules/taxonomy";
import {
  pillarHubPositions,
  pillarNodeId,
  sourceNodeId,
  unsortedRegionLayout,
  UNSORTED_REGION_ID,
} from "./layout";

export type AtlasNodeKind = "pillarHub" | "claimCard" | "sourceCard" | "unsortedRegion";

export type AtlasNodeData = {
  kind: AtlasNodeKind;
  label: string;
  claim?: Claim;
  source?: Source;
  pillarId?: string;
  accent?: string;
  count?: number;
  dimmed: boolean;
  conflict?: boolean;
};

export type AtlasNode = Node<AtlasNodeData, AtlasNodeKind | "group">;
export type AtlasEdge = Edge<{ relationship?: Relationship; dimmed?: boolean }>;

function includesText(value: string | null | undefined, needle: string): boolean {
  return Boolean(value?.toLowerCase().includes(needle));
}

function claimMatchesSearch(claim: Claim, source: Source | undefined, query: string): boolean {
  if (!query) return true;
  return (
    includesText(claim.canonicalText, query) ||
    includesText(claim.originalText, query) ||
    includesText(claim.topic, query) ||
    includesText(claim.tags.join(" "), query) ||
    includesText(source?.title, query) ||
    includesText(source?.creatorName, query) ||
    includesText(source?.platform, query)
  );
}

function claimMatchesFilters(claim: Claim, filters: ClaimSearchFilters): boolean {
  if (filters.pillarId && claim.pillarId !== filters.pillarId) return false;
  if (filters.claimType && claim.claimType !== filters.claimType) return false;
  if (filters.itemType && claim.itemType !== filters.itemType) return false;
  if (filters.verificationStatus && claim.verificationStatus !== filters.verificationStatus) {
    return false;
  }
  if (filters.evidenceLevel && claim.evidenceLevel !== filters.evidenceLevel) return false;
  if (filters.minConfidence !== undefined && claim.confidence < filters.minConfidence) return false;
  return true;
}

function hasActiveMatching(search: string, filters: ClaimSearchFilters): boolean {
  return (
    search.trim().length > 0 ||
    filters.pillarId !== undefined ||
    filters.claimType !== undefined ||
    filters.itemType !== undefined ||
    filters.verificationStatus !== undefined ||
    filters.evidenceLevel !== undefined ||
    filters.minConfidence !== undefined
  );
}

function nodeClass(dimmed: boolean, matched: boolean): string {
  if (dimmed) return "opacity-25 pointer-events-none";
  if (matched) return "ring-2 ring-primary ring-offset-2 ring-offset-background";
  return "";
}

function edgeStyle(type: Relationship["relationshipType"] | "membership" | "derived_from") {
  if (type === "contradicts") {
    return { stroke: "var(--destructive)", strokeWidth: 2 };
  }
  if (type === "derived_from") {
    return { stroke: "var(--muted-foreground)", strokeDasharray: "5 5", strokeWidth: 1.2 };
  }
  return { stroke: "color-mix(in oklch, var(--muted-foreground), transparent 35%)", strokeWidth: 1 };
}

export function buildAtlasGraph({
  claims,
  relationships,
  sources,
  positions,
  search,
  filters,
  collapsedPillars,
}: {
  claims: Claim[];
  relationships: Relationship[];
  sources: Source[];
  positions: Record<string, NodePosition>;
  search: string;
  filters: ClaimSearchFilters;
  collapsedPillars: Set<string>;
}): { nodes: AtlasNode[]; edges: AtlasEdge[] } {
  const activeClaims = claims.filter(
    (claim) => claim.status === "unsorted" || claim.status === "organized",
  );
  const query = search.trim().toLowerCase();
  const activeMatching = hasActiveMatching(query, filters);
  const sourcesById = new Map(sources.map((source) => [source.id, source]));
  const claimsById = new Map(activeClaims.map((claim) => [claim.id, claim]));
  const matchByClaimId = new Map<string, boolean>();
  for (const claim of activeClaims) {
    const source = claim.sourceId ? sourcesById.get(claim.sourceId) : undefined;
    matchByClaimId.set(
      claim.id,
      claimMatchesSearch(claim, source, query) && claimMatchesFilters(claim, filters),
    );
  }

  const hubs = pillarHubPositions();
  const unsorted = unsortedRegionLayout(sources, activeClaims);
  const relationshipConflictIds = new Set(
    relationships
      .filter((relationship) => relationship.relationshipType === "contradicts")
      .flatMap((relationship) => [relationship.fromClaimId, relationship.toClaimId]),
  );

  const nodes: AtlasNode[] = [
    {
      id: UNSORTED_REGION_ID,
      type: "group",
      position: { x: unsorted.region.x, y: unsorted.region.y },
      data: {
        kind: "unsortedRegion",
        label: "Unsorted Imports",
        dimmed: false,
      },
      draggable: false,
      selectable: false,
      style: {
        width: unsorted.region.width,
        height: unsorted.region.height,
        zIndex: -1,
      },
    },
  ];

  for (const pillar of PILLARS) {
    const pillarClaims = activeClaims.filter((claim) => claim.pillarId === pillar.id);
    const matched = pillarClaims.some((claim) => matchByClaimId.get(claim.id));
    const dimmed = activeMatching && !matched && !includesText(pillar.name, query);
    nodes.push({
      id: pillarNodeId(pillar.id),
      type: "pillarHub",
      position: hubs[pillar.id]!,
      data: {
        kind: "pillarHub",
        label: pillar.name,
        pillarId: pillar.id,
        accent: pillar.accent,
        count: pillarClaims.length,
        dimmed,
      },
      draggable: false,
      selectable: true,
      focusable: true,
      ariaLabel: `${pillar.name} pillar`,
      className: nodeClass(dimmed, activeMatching && !dimmed),
    });
  }

  const unsortedClaims = activeClaims.filter((claim) => claim.status === "unsorted");
  const unsortedSourceIds = new Set(unsortedClaims.map((claim) => claim.sourceId).filter(Boolean));
  for (const source of sources) {
    if (!unsortedSourceIds.has(source.id)) continue;
    const sourceClaims = unsortedClaims.filter((claim) => claim.sourceId === source.id);
    const matched = sourceClaims.some((claim) => matchByClaimId.get(claim.id));
    const dimmed = activeMatching && !matched && !includesText(source.title, query);
    nodes.push({
      id: sourceNodeId(source.id),
      type: "sourceCard",
      position: positions[sourceNodeId(source.id)] ?? unsorted.positions[sourceNodeId(source.id)]!,
      data: {
        kind: "sourceCard",
        label: source.title,
        source,
        count: sourceClaims.length,
        dimmed,
      },
      focusable: true,
      ariaLabel: `${source.title} source`,
      className: nodeClass(dimmed, activeMatching && !dimmed),
    });
  }

  for (const claim of activeClaims) {
    if (collapsedPillars.has(claim.pillarId)) continue;
    const matched = matchByClaimId.get(claim.id) ?? true;
    const dimmed = activeMatching && !matched;
    const fallback = claim.status === "unsorted" ? unsorted.positions[claim.id] : undefined;
    nodes.push({
      id: claim.id,
      type: "claimCard",
      position: positions[claim.id] ?? fallback ?? hubs[claim.pillarId] ?? { x: 0, y: 0 },
      data: {
        kind: "claimCard",
        label: claim.canonicalText,
        claim,
        pillarId: claim.pillarId,
        accent: PILLARS.find((pillar) => pillar.id === claim.pillarId)?.accent,
        dimmed,
        conflict: claim.tags.includes("conflict") || relationshipConflictIds.has(claim.id),
      },
      focusable: true,
      ariaLabel: `Claim: ${claim.canonicalText}`,
      className: nodeClass(dimmed, activeMatching && matched),
    });
  }

  const edges: AtlasEdge[] = [];
  for (const claim of activeClaims) {
    if (collapsedPillars.has(claim.pillarId)) continue;
    edges.push({
      id: `membership:${claim.id}:${claim.pillarId}`,
      source: claim.id,
      target: pillarNodeId(claim.pillarId),
      type: "smoothstep",
      selectable: false,
      style: edgeStyle("membership"),
    });
    if (claim.status === "unsorted" && claim.sourceId && unsortedSourceIds.has(claim.sourceId)) {
      edges.push({
        id: `derived:${claim.id}:${claim.sourceId}`,
        source: claim.id,
        target: sourceNodeId(claim.sourceId),
        type: "smoothstep",
        selectable: false,
        style: edgeStyle("derived_from"),
      });
    }
  }

  for (const relationship of relationships) {
    if (!claimsById.has(relationship.fromClaimId) || !claimsById.has(relationship.toClaimId)) {
      continue;
    }
    edges.push({
      id: relationship.id,
      source: relationship.fromClaimId,
      target: relationship.toClaimId,
      type: "smoothstep",
      animated: relationship.relationshipType === "contradicts",
      label:
        relationship.relationshipType === "contradicts"
          ? "contradicts"
          : relationship.relationshipType.replaceAll("_", " "),
      data: { relationship },
      style: edgeStyle(relationship.relationshipType),
    });
  }

  return { nodes, edges };
}
