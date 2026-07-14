import { beforeEach, describe, expect, it } from "vitest";
import { createDatabase } from "@/db";
import type { Repositories } from "./types";
import type { Claim, Source } from "@/lib/types";
import { PILLARS } from "@/modules/taxonomy";

function makeSource(overrides: Partial<Source> = {}): Source {
  return {
    id: `src-${Math.random().toString(36).slice(2)}`,
    type: "text",
    title: "Test source",
    creatorName: null,
    platform: null,
    sourceUrl: null,
    durationSeconds: null,
    description: null,
    importedAt: new Date().toISOString(),
    processingStatus: "uploaded",
    errorMessage: null,
    checksum: null,
    ...overrides,
  };
}

function makeClaim(overrides: Partial<Claim> = {}): Claim {
  const now = new Date().toISOString();
  return {
    id: `claim-${Math.random().toString(36).slice(2)}`,
    sourceId: null,
    canonicalText: "Test claim",
    originalText: "test claim original",
    timestampStart: null,
    timestampEnd: null,
    itemType: "advice",
    claimType: "recommendation",
    scope: ["universal"],
    authorityType: "unknown_or_self_reported",
    evidenceLevel: "unknown",
    verificationStatus: "unverified",
    freshnessStatus: "unknown",
    confidence: 0.5,
    pillarId: "mcat",
    topic: "Testing",
    tags: [],
    suggestedActions: [],
    status: "pending_review",
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe("sqlite repositories", () => {
  let repos: Repositories;

  beforeEach(() => {
    ({ repos } = createDatabase(":memory:", { seed: false }));
  });

  it("creates and reads back a source with all fields", () => {
    const source = makeSource({
      creatorName: "@creator",
      platform: "TikTok",
      durationSeconds: 61.5,
      checksum: "abc123",
    });
    repos.sources.create(source);
    expect(repos.sources.getById(source.id)).toEqual(source);
  });

  it("rejects duplicate checksums (Section 28.1 constraint)", () => {
    repos.sources.create(makeSource({ checksum: "same" }));
    expect(() => repos.sources.create(makeSource({ checksum: "same" }))).toThrow();
    expect(repos.sources.findByChecksum("same")).not.toBeNull();
  });

  it("allows many sources with null checksum", () => {
    repos.sources.create(makeSource({ checksum: null }));
    repos.sources.create(makeSource({ checksum: null }));
    expect(repos.sources.list()).toHaveLength(2);
  });

  it("round-trips claim JSON fields (scope, tags, suggestedActions)", () => {
    const claim = makeClaim({
      scope: ["applicant_specific", "cycle_specific"],
      tags: ["numerical", "hours"],
      suggestedActions: [{ title: "Do a thing", description: "Because reasons" }],
    });
    repos.claims.create(claim);
    expect(repos.claims.getById(claim.id)).toEqual(claim);
  });

  it("updates a claim and bumps updatedAt", () => {
    const claim = makeClaim({ updatedAt: "2020-01-01T00:00:00.000Z" });
    repos.claims.create(claim);
    const updated = repos.claims.update(claim.id, {
      canonicalText: "Edited text",
      pillarId: "research",
    });
    expect(updated.canonicalText).toBe("Edited text");
    expect(updated.pillarId).toBe("research");
    expect(updated.updatedAt > claim.updatedAt).toBe(true);
  });

  it("filters claims by status, pillar, and confidence", () => {
    repos.claims.create(makeClaim({ status: "organized", pillarId: "mcat", confidence: 0.9 }));
    repos.claims.create(makeClaim({ status: "unsorted", pillarId: "mcat", confidence: 0.4 }));
    repos.claims.create(makeClaim({ status: "organized", pillarId: "research", confidence: 0.8 }));

    expect(repos.claims.list({ status: "organized" })).toHaveLength(2);
    expect(repos.claims.list({ status: ["organized", "unsorted"] })).toHaveLength(3);
    expect(repos.claims.list({ pillarId: "mcat" })).toHaveLength(2);
    expect(repos.claims.list({ minConfidence: 0.75 })).toHaveLength(2);
  });

  it("searches claim text, topic, tags, and joined source title", () => {
    const source = makeSource({ title: "Shadowing masterclass" });
    repos.sources.create(source);
    repos.claims.create(
      makeClaim({ canonicalText: "Start shadowing early", sourceId: source.id }),
    );
    repos.claims.create(makeClaim({ canonicalText: "Unrelated", topic: "MCAT retakes" }));
    repos.claims.create(makeClaim({ canonicalText: "Also unrelated", tags: ["shadowing"] }));

    expect(repos.claims.search("shadowing")).toHaveLength(2);
    expect(repos.claims.search("masterclass")).toHaveLength(1);
    expect(repos.claims.search("retakes")).toHaveLength(1);
    expect(repos.claims.search("zzz-no-match")).toHaveLength(0);
  });

  it("cascades claim deletion when a source is deleted", () => {
    const source = makeSource();
    repos.sources.create(source);
    const claim = makeClaim({ sourceId: source.id });
    repos.claims.create(claim);
    repos.sources.delete(source.id);
    expect(repos.claims.getById(claim.id)).toBeNull();
  });

  it("stores and retrieves relationships between claims", () => {
    const a = makeClaim();
    const b = makeClaim();
    repos.claims.createMany([a, b]);
    repos.relationships.create({
      id: "rel-1",
      fromClaimId: a.id,
      toClaimId: b.id,
      relationshipType: "contradicts",
      note: "test",
      userConfirmed: true,
    });
    expect(repos.relationships.listForClaim(a.id)).toHaveLength(1);
    expect(repos.relationships.listForClaim(b.id)[0]?.relationshipType).toBe("contradicts");
  });

  it("saves and updates the default layout", () => {
    expect(repos.layouts.getDefault()).toBeNull();
    repos.layouts.savePositions({ "node-1": { x: 10, y: 20 } });
    repos.layouts.savePositions({ "node-1": { x: 30, y: 40 } });
    expect(repos.layouts.getDefault()?.nodePositions["node-1"]).toEqual({ x: 30, y: 40 });
    repos.layouts.reset();
    expect(repos.layouts.getDefault()).toBeNull();
  });

  it("counts claims per pillar excluding rejected", () => {
    repos.claims.create(makeClaim({ pillarId: "mcat" }));
    repos.claims.create(makeClaim({ pillarId: "mcat", status: "rejected" }));
    repos.claims.create(makeClaim({ pillarId: "research" }));
    expect(repos.claims.countByPillar()).toEqual({ mcat: 1, research: 1 });
  });
});

describe("seed data", () => {
  it("seeds the Section 41 demo content", () => {
    const { repos } = createDatabase(":memory:");
    const claims = repos.claims.list();
    const sources = repos.sources.list();

    // Seed 1 waits in the Unsorted Imports region.
    const unsorted = claims.filter((c) => c.status === "unsorted");
    expect(unsorted.length).toBeGreaterThanOrEqual(3);
    expect(repos.claims.getById("seed-claim-500hours")?.verificationStatus).toBe("unverified");

    // Conflicting MCAT pair linked by a contradicts relationship.
    const rels = repos.relationships.listForClaim("seed-claim-mcat-long");
    expect(rels.some((r) => r.relationshipType === "contradicts")).toBe(true);

    // Officially verified prerequisite claim.
    expect(repos.claims.getById("seed-claim-prereq-bio")?.verificationStatus).toBe(
      "officially_verified",
    );

    // Reflection, resource, action, research source all present.
    expect(claims.some((c) => c.itemType === "reflection")).toBe(true);
    expect(claims.some((c) => c.itemType === "resource")).toBe(true);
    expect(repos.actions.list().some((a) => a.derivedFromClaimId === "seed-claim-lor-timing")).toBe(
      true,
    );
    expect(sources.some((s) => s.id === "seed-src-research")).toBe(true);

    // Every claim references a real pillar.
    const pillarIds = new Set(PILLARS.map((p) => p.id));
    for (const claim of claims) {
      expect(pillarIds.has(claim.pillarId)).toBe(true);
    }

    // Transcript for the unsorted source has the 0:42 segment used by the demo.
    const transcript = repos.transcripts.getBySourceId("seed-src-clinical");
    expect(transcript?.segments.some((s) => s.startSeconds === 42)).toBe(true);
  });
});
