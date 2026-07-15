import { describe, expect, it } from "vitest";
import { createDatabase } from "@/db";
import {
  cosineSimilarity,
  jaccard,
  MockSimilarityProvider,
  scanForDuplicates,
  tokenSet,
  textHash,
} from "./index";
import type { Claim } from "@/lib/types";

function makeClaim(id: string, text: string, overrides: Partial<Claim> = {}): Claim {
  const now = new Date().toISOString();
  return {
    id,
    sourceId: null,
    canonicalText: text,
    originalText: text,
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
    status: "organized",
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe("similarity math", () => {
  it("jaccard over token sets ignores stopwords and punctuation", () => {
    const a = tokenSet("Ask for letters while the relationship is active!");
    const b = tokenSet("ask for letters while your relationship stays active");
    expect(jaccard(a, b)).toBeGreaterThan(0.5);
    expect(jaccard(a, tokenSet("Study MCAT physics daily"))).toBe(0);
  });

  it("cosine similarity behaves at the boundaries", () => {
    expect(cosineSimilarity([1, 0], [1, 0])).toBeCloseTo(1);
    expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0);
    expect(cosineSimilarity([], [])).toBe(0);
  });

  it("textHash is deterministic and edit-sensitive", () => {
    expect(textHash("abc")).toBe(textHash("abc"));
    expect(textHash("abc")).not.toBe(textHash("abd"));
  });
});

describe("MockSimilarityProvider", () => {
  it("finds near-duplicate pairs deterministically", async () => {
    const provider = new MockSimilarityProvider();
    const claims = [
      { id: "a", text: "Ask for recommendation letters while the relationship is active." },
      { id: "b", text: "Ask for your recommendation letters while the relationship is still active." },
      { id: "c", text: "Study for the MCAT using daily practice questions." },
    ];
    const pairs = await provider.similarPairs(claims);
    expect(pairs).toHaveLength(1);
    expect([pairs[0]!.aId, pairs[0]!.bId].sort()).toEqual(["a", "b"]);
    expect(pairs).toEqual(await provider.similarPairs(claims));
  });
});

describe("scanForDuplicates", () => {
  it("records unconfirmed duplicates and skips already-linked pairs", async () => {
    const { repos } = createDatabase(":memory:", { seed: false });
    repos.claims.createMany([
      makeClaim("dup-a", "Ask for recommendation letters while the relationship is active."),
      makeClaim("dup-b", "Ask for your recommendation letters while the relationship is still active."),
      makeClaim("other", "Shadow a primary care physician early in college."),
    ]);

    const first = await scanForDuplicates(repos, new MockSimilarityProvider());
    expect(first.suggested).toBe(1);
    const rels = repos.relationships.list();
    expect(rels).toHaveLength(1);
    expect(rels[0]!.relationshipType).toBe("duplicates");
    expect(rels[0]!.userConfirmed).toBe(false);
    expect(rels[0]!.note).toContain("similarity");

    // Re-scan suggests nothing new.
    const second = await scanForDuplicates(repos, new MockSimilarityProvider());
    expect(second.suggested).toBe(0);
  });

  it("restricts suggestions to pairs involving the given claims", async () => {
    const { repos } = createDatabase(":memory:", { seed: false });
    repos.claims.createMany([
      makeClaim("old-a", "Ask for recommendation letters while the relationship is active."),
      makeClaim("old-b", "Ask for your recommendation letters while the relationship is still active."),
      makeClaim("new-c", "Volunteer with underserved communities consistently for years."),
    ]);
    const result = await scanForDuplicates(repos, new MockSimilarityProvider(), {
      onlyInvolving: ["new-c"],
    });
    // old-a/old-b are near-duplicates but neither is "new-c".
    expect(result.suggested).toBe(0);
    expect(repos.relationships.list()).toHaveLength(0);
  });

  it("ignores rejected claims", async () => {
    const { repos } = createDatabase(":memory:", { seed: false });
    repos.claims.createMany([
      makeClaim("a", "Ask for recommendation letters while the relationship is active."),
      makeClaim("b", "Ask for your recommendation letters while the relationship is still active.", {
        status: "rejected",
      }),
    ]);
    const result = await scanForDuplicates(repos, new MockSimilarityProvider());
    expect(result.suggested).toBe(0);
  });
});

describe("embedding cache repository", () => {
  it("round-trips vectors and upserts on conflict", () => {
    const { repos } = createDatabase(":memory:", { seed: false });
    repos.claims.create(makeClaim("emb-1", "Some claim text"));
    repos.embeddings.upsert({ claimId: "emb-1", model: "m", vector: [0.1, 0.2], textHash: "h1" });
    repos.embeddings.upsert({ claimId: "emb-1", model: "m", vector: [0.3, 0.4], textHash: "h2" });
    const cached = repos.embeddings.getMany(["emb-1", "missing"]);
    expect(cached).toHaveLength(1);
    expect(cached[0]!.vector).toEqual([0.3, 0.4]);
    expect(cached[0]!.textHash).toBe("h2");
  });
});
