import { describe, expect, it } from "vitest";
import type { Claim, Relationship, Source } from "@/lib/types";
import { PILLARS } from "@/modules/taxonomy";
import {
  ATLAS_CELL_HEIGHT,
  ATLAS_CELL_WIDTH,
  claimPositionsAround,
  computeOrganizeTargets,
  pillarHubPositions,
} from "./layout";
import { buildAtlasGraph } from "./build";

const baseSource: Source = {
  id: "source-a",
  type: "text",
  title: "Advice note",
  creatorName: null,
  platform: "Notebook",
  sourceUrl: null,
  durationSeconds: null,
  description: null,
  importedAt: "2026-07-01T00:00:00.000Z",
  processingStatus: "complete",
  errorMessage: null,
  checksum: null,
};

function claim(id: string, patch: Partial<Claim> = {}): Claim {
  return {
    id,
    sourceId: "source-a",
    canonicalText: `Clinical claim ${id}`,
    originalText: "Clinical hours matter.",
    timestampStart: 18,
    timestampEnd: 30,
    itemType: "advice",
    claimType: "recommendation",
    scope: ["unknown"],
    authorityType: "unknown_or_self_reported",
    evidenceLevel: "unknown",
    verificationStatus: "unverified",
    freshnessStatus: "unknown",
    confidence: 0.7,
    pillarId: "clinical-experience",
    topic: "Clinical hours",
    tags: [],
    suggestedActions: [],
    status: "unsorted",
    createdAt: "2026-07-01T00:00:00.000Z",
    updatedAt: "2026-07-01T00:00:00.000Z",
    ...patch,
  };
}

describe("atlas layout", () => {
  it("places pillar hubs in a 5 by 4 ordered grid", () => {
    const hubs = pillarHubPositions();
    expect(Object.keys(hubs)).toHaveLength(20);
    expect(hubs["north-star"]).toEqual({ x: 0, y: 0 });
    expect(hubs["clinical-experience"]).toEqual({ x: ATLAS_CELL_WIDTH * 4, y: 0 });
    expect(hubs["shadowing"]).toEqual({ x: 0, y: ATLAS_CELL_HEIGHT });
    expect(PILLARS.at(-1)?.id).toBe("choosing-school");
  });

  it("keeps a 30-claim spiral reasonably separated", () => {
    const claims = Array.from({ length: 30 }, (_, index) => ({ id: `c${index}` }));
    const positions = Object.values(claimPositionsAround({ x: 0, y: 0 }, claims));
    let minDistance = Infinity;
    for (let i = 0; i < positions.length; i++) {
      for (let j = i + 1; j < positions.length; j++) {
        const dx = positions[i]!.x - positions[j]!.x;
        const dy = positions[i]!.y - positions[j]!.y;
        minDistance = Math.min(minDistance, Math.hypot(dx, dy));
      }
    }
    expect(minDistance).toBeGreaterThan(55);
  });

  it("lands organize targets in the owning pillar cell", () => {
    const targets = computeOrganizeTargets([claim("a"), claim("b", { pillarId: "mcat" })]);
    const clinicalHub = pillarHubPositions()["clinical-experience"]!;
    const mcatHub = pillarHubPositions()["mcat"]!;
    expect(Math.abs(targets.a!.x - clinicalHub.x)).toBeLessThan(ATLAS_CELL_WIDTH / 2);
    expect(Math.abs(targets.b!.x - mcatHub.x)).toBeLessThan(ATLAS_CELL_WIDTH / 2);
  });
});

describe("atlas graph build", () => {
  it("dims non-matching nodes without removing them", () => {
    const claims = [
      claim("clinical", { canonicalText: "Clinical hours are useful." }),
      claim("mcat", {
        canonicalText: "MCAT practice exams matter.",
        originalText: "Practice exams help calibrate prep.",
        pillarId: "mcat",
        topic: "Practice exams",
      }),
    ];
    const graph = buildAtlasGraph({
      claims,
      relationships: [],
      sources: [baseSource],
      positions: {},
      search: "clinical hours",
      filters: {},
      collapsedPillars: new Set(),
    });
    expect(graph.nodes.some((node) => node.id === "clinical")).toBe(true);
    expect(graph.nodes.some((node) => node.id === "mcat")).toBe(true);
    expect(graph.nodes.find((node) => node.id === "clinical")?.data.dimmed).toBe(false);
    expect(graph.nodes.find((node) => node.id === "mcat")?.data.dimmed).toBe(true);
  });

  it("styles contradiction edges as animated relationship edges", () => {
    const relationships: Relationship[] = [
      {
        id: "rel-a",
        fromClaimId: "a",
        toClaimId: "b",
        relationshipType: "contradicts",
        note: "Conflict",
        userConfirmed: false,
      },
    ];
    const graph = buildAtlasGraph({
      claims: [claim("a"), claim("b")],
      relationships,
      sources: [baseSource],
      positions: {},
      search: "",
      filters: {},
      collapsedPillars: new Set(),
    });
    expect(graph.edges.find((edge) => edge.id === "rel-a")?.animated).toBe(true);
  });
});
