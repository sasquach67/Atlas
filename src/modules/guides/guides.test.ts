import { describe, expect, it } from "vitest";
import { createDatabase } from "@/db";
import { extractCitedIds, GuideGenerationFailedError } from "./types";
import { MockGuideProvider } from "./mock-provider";
import { generateAtlasGuide, markGuideStaleForClaim, sectionIdFor } from "./generate";
import type { GuideGenerationProvider } from "./types";

describe("citation helpers", () => {
  it("extracts unique [^id] markers including hyphenated seed ids", () => {
    const ids = extractCitedIds(
      "First point [^seed-claim-500hours]. Second [^abc-123] and again [^seed-claim-500hours].",
    );
    expect(ids).toEqual(["seed-claim-500hours", "abc-123"]);
  });
});

describe("generateAtlasGuide with the mock provider (seed data)", () => {
  it("builds cited sections grouped by pillar and topic", async () => {
    const { repos } = createDatabase(":memory:");
    const result = await generateAtlasGuide(repos, new MockGuideProvider());

    expect(result.failures).toEqual([]);
    expect(result.sectionsGenerated).toBeGreaterThanOrEqual(5);
    expect(result.guide.status).toBe("current");
    expect(result.guide.version).toBe(1);

    const sections = repos.guides.listSections(result.guide.id);
    // Every citation resolves to a claim in that section's supporting set.
    for (const section of sections) {
      const cited = extractCitedIds(section.bodyMarkdown);
      expect(cited.length).toBeGreaterThan(0);
      for (const id of cited) {
        expect(section.supportingClaimIds).toContain(id);
        expect(repos.claims.getById(id)).not.toBeNull();
      }
    }

    // The MCAT study-timeline section carries the confirmed contradiction callout.
    const mcatSection = sections.find(
      (section) => section.id === sectionIdFor("mcat", "Study timeline"),
    );
    expect(mcatSection).toBeDefined();
    expect(mcatSection!.bodyMarkdown).toContain("Sources disagree");
    expect(mcatSection!.unresolvedContradictionIds).toContain("seed-claim-mcat-long");
  });

  it("marks sections stale on claim change and regenerates only those", async () => {
    const { repos } = createDatabase(":memory:");
    await generateAtlasGuide(repos, new MockGuideProvider());

    const claim = repos.claims.getById("seed-claim-prereq-bio")!;
    repos.claims.update(claim.id, { canonicalText: "Edited biology requirement claim." });
    markGuideStaleForClaim(repos, claim);

    const guide = repos.guides.getAtlasGuide()!;
    expect(guide.status).toBe("stale");
    const staleSections = repos.guides.listSections(guide.id).filter((s) => s.stale);
    expect(staleSections).toHaveLength(1);
    expect(staleSections[0]!.pillarId).toBe("prerequisites");

    const rerun = await generateAtlasGuide(repos, new MockGuideProvider(), { onlyStale: true });
    expect(rerun.sectionsGenerated).toBe(1);
    expect(rerun.sectionsSkipped).toBeGreaterThan(3);
    expect(rerun.guide.status).toBe("current");
    const refreshed = repos.guides
      .listSections(guide.id)
      .find((section) => section.pillarId === "prerequisites")!;
    expect(refreshed.stale).toBe(false);
    expect(refreshed.bodyMarkdown).toContain("Edited biology requirement claim.");
  });

  it("rejects provider output citing claims it was not given", async () => {
    const { repos } = createDatabase(":memory:");
    const rogueProvider: GuideGenerationProvider = {
      name: "rogue",
      async synthesizeSection() {
        return { bodyMarkdown: "Invented fact [^not-a-real-claim].", supportingClaimIds: [] };
      },
    };
    const result = await generateAtlasGuide(repos, rogueProvider);
    expect(result.sectionsGenerated).toBe(0);
    expect(result.failures.length).toBeGreaterThan(0);
    expect(result.failures[0]!.message).toContain("unknown claims");
    expect(result.guide.status).toBe("stale");
  });

  it("keeps the previous section body when a regeneration fails", async () => {
    const { repos } = createDatabase(":memory:");
    await generateAtlasGuide(repos, new MockGuideProvider());
    const failingProvider: GuideGenerationProvider = {
      name: "failing",
      async synthesizeSection() {
        throw new GuideGenerationFailedError("Provider exploded.", true);
      },
    };
    const result = await generateAtlasGuide(repos, failingProvider);
    expect(result.sectionsGenerated).toBe(0);
    const sections = repos.guides.listSections(result.guide.id);
    expect(sections.length).toBeGreaterThan(0);
    for (const section of sections) {
      expect(section.bodyMarkdown.length).toBeGreaterThan(0);
      expect(section.stale).toBe(true);
    }
  });
});
