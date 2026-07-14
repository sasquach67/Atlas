import { afterEach, describe, expect, it } from "vitest";
import { ExtractionResultSchema } from "@/lib/schema/extraction";
import { MockExtractionProvider } from "./mock-provider";
import { getExtractionProvider } from "./index";
import type { ExtractionInput } from "./types";
import {
  MockTranscriptionProvider,
  parseTranscriptText,
} from "@/modules/transcript";

const DEMO_TRANSCRIPT = `Okay, real talk about clinical hours. I'm an MS2 now. You need at least 500 clinical hours to apply. That's the floor. It has to be real patient contact. Keep a journal after every shift.`;

function input(fullText: string, title = "Test video"): ExtractionInput {
  return {
    source: { title, creatorName: "@tester", platform: "TikTok", type: "video", description: null },
    transcript: parseTranscriptText(fullText),
  };
}

describe("MockExtractionProvider", () => {
  const provider = new MockExtractionProvider();

  it("returns the 500-hours fixture for the demo transcript, schema-valid", async () => {
    const result = await provider.extract(input(DEMO_TRANSCRIPT));
    expect(() => ExtractionResultSchema.parse(result)).not.toThrow();
    expect(result.claims.length).toBe(4);
    const threshold = result.claims.find((c) => c.canonicalText.includes("500 clinical hours"));
    expect(threshold?.verificationStatus).toBe("unverified");
    expect(threshold?.scope).not.toContain("universal");
    expect(result.claims.some((c) => c.itemType === "warning")).toBe(true);
    expect(result.possibleContradictions).toHaveLength(1);
  });

  it("is deterministic: same input, same output", async () => {
    const text = "You should study for the MCAT with daily practice questions. I raised my score 12 points in 3 months. Don't rely on passive content review.";
    const a = await provider.extract(input(text));
    const b = await provider.extract(input(text));
    expect(a).toEqual(b);
  });

  it("classifies heuristically and always passes the schema", async () => {
    const text =
      "You should ask professors for letters before the semester ends. Don't wait two years to ask. I asked my organic chemistry professor in person and it worked. You need at least 3 letters for most schools.";
    const result = await provider.extract(input(text, "LOR advice"));
    expect(() => ExtractionResultSchema.parse(result)).not.toThrow();
    expect(result.claims.some((c) => c.claimType === "warning")).toBe(true);
    expect(result.claims.some((c) => c.claimType === "anecdote")).toBe(true);
    // Numeric threshold sentence spawns a paired no-universal-standard warning.
    expect(
      result.claims.filter((c) => c.tags.includes("no-official-standard")).length,
    ).toBe(1);
    // LOR keywords should classify into the letters pillar.
    expect(result.claims.some((c) => c.pillarId === "letters")).toBe(true);
  });

  it("attaches timestamps from matching segments", async () => {
    const result = await provider.extract(
      input("[0:10] You should shadow a primary care doctor early.\n[0:25] Avoid shadowing only surgeons."),
    );
    const first = result.claims[0];
    expect(first?.timestampStart).toBe(10);
  });
});

describe("provider selection", () => {
  const savedKey = process.env.ANTHROPIC_API_KEY;
  const savedForce = process.env.ATLAS_FORCE_MOCK_AI;

  afterEach(() => {
    if (savedKey === undefined) delete process.env.ANTHROPIC_API_KEY;
    else process.env.ANTHROPIC_API_KEY = savedKey;
    if (savedForce === undefined) delete process.env.ATLAS_FORCE_MOCK_AI;
    else process.env.ATLAS_FORCE_MOCK_AI = savedForce;
  });

  it("uses the mock without a key", () => {
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.ATLAS_FORCE_MOCK_AI;
    expect(getExtractionProvider().name).toBe("mock-extractor-v1");
  });

  it("uses Anthropic with a key", () => {
    process.env.ANTHROPIC_API_KEY = "sk-test-not-real";
    delete process.env.ATLAS_FORCE_MOCK_AI;
    expect(getExtractionProvider().name).toContain("anthropic:");
  });

  it("ATLAS_FORCE_MOCK_AI pins the mock even with a key", () => {
    process.env.ANTHROPIC_API_KEY = "sk-test-not-real";
    process.env.ATLAS_FORCE_MOCK_AI = "1";
    expect(getExtractionProvider().name).toBe("mock-extractor-v1");
  });
});

describe("parseTranscriptText", () => {
  it("parses [MM:SS] prefixed lines into real segments", () => {
    const result = parseTranscriptText(
      "[0:00] First line here.\n[0:12] Second line here.\n[1:05] Third line here.",
    );
    expect(result.model).toBe("paste-timestamped");
    expect(result.segments).toHaveLength(3);
    expect(result.segments[1]).toMatchObject({ startSeconds: 12, endSeconds: 65 });
  });

  it("parses bare MM:SS and H:MM:SS prefixes", () => {
    const result = parseTranscriptText("0:05 Intro sentence.\n1:02:30 Deep into the podcast.");
    expect(result.model).toBe("paste-timestamped");
    expect(result.segments[0]?.startSeconds).toBe(5);
    expect(result.segments[1]?.startSeconds).toBe(3750);
  });

  it("synthesizes proportional timestamps for plain text", () => {
    const result = parseTranscriptText(
      "This is the first sentence of advice. Here is a second sentence that is a bit longer than the first one. Short third.",
    );
    expect(result.model).toBe("paste");
    expect(result.segments.length).toBeGreaterThanOrEqual(2);
    expect(result.segments[0]?.startSeconds).toBe(0);
    const [a, b] = result.segments;
    expect(b!.startSeconds).toBe(a!.endSeconds);
  });
});

describe("MockTranscriptionProvider", () => {
  it("is deterministic per file identity and produces contiguous segments", async () => {
    const provider = new MockTranscriptionProvider(0);
    const file = { name: "clinic-vlog.mp4", size: 1024, type: "video/mp4" };
    const a = await provider.transcribe(file);
    const b = await provider.transcribe(file);
    expect(a).toEqual(b);
    expect(a.segments.length).toBeGreaterThanOrEqual(4);
    for (let i = 1; i < a.segments.length; i++) {
      expect(a.segments[i]!.startSeconds).toBe(a.segments[i - 1]!.endSeconds);
    }
    const other = await provider.transcribe({ ...file, name: "other.mp4" });
    expect(other.fullText).not.toEqual(a.fullText);
  });
});
