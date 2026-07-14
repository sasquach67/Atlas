import { describe, expect, it } from "vitest";
import { createDatabase } from "@/db";
import { importSource, ImportSourceSchema } from "./index";

describe("ingestion import logic", () => {
  it("rejects pasted transcripts above the MVP limit", () => {
    const parsed = ImportSourceSchema.safeParse({
      kind: "text",
      text: "x".repeat(50_001),
    });
    expect(parsed.success).toBe(true);
    if (!parsed.success) throw new Error("Expected import schema to accept long text shape.");

    const { repos } = createDatabase(":memory:", { seed: false });
    const result = importSource(repos, parsed.data);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(400);
      expect(result.message).toContain("50,000");
    }
  });

  it("guards duplicate file imports by checksum", () => {
    const { repos } = createDatabase(":memory:", { seed: false });
    const input = {
      kind: "file" as const,
      fileName: "clinical-hours.mp3",
      fileSize: 128,
      fileType: "audio/mpeg",
    };
    const first = importSource(repos, input);
    const second = importSource(repos, input);

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(false);
    if (!second.ok) {
      expect(second.status).toBe(409);
      expect(second.existingSource?.title).toBe("clinical-hours.mp3");
    }
  });
});
