import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createDatabase } from "@/db";
import { importSource, ImportSourceSchema, importUploadedFile, processSource } from "./index";
import { MockTranscriptionProvider } from "@/modules/transcript";
import { MockExtractionProvider } from "@/modules/extraction";

let mediaDir: string;

beforeEach(() => {
  mediaDir = fs.mkdtempSync(path.join(os.tmpdir(), "atlas-media-"));
  process.env.ATLAS_MEDIA_DIR = mediaDir;
});

afterEach(() => {
  delete process.env.ATLAS_MEDIA_DIR;
  fs.rmSync(mediaDir, { recursive: true, force: true });
});

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

  it("stores uploaded media bytes and guards duplicates by content checksum", () => {
    const { repos } = createDatabase(":memory:", { seed: false });
    const bytes = new TextEncoder().encode("fake audio bytes");
    const input = { fileName: "clinical-hours.mp3", fileType: "audio/mpeg", bytes };

    const first = importUploadedFile(repos, input);
    expect(first.ok).toBe(true);
    if (first.ok) {
      expect(first.source.mediaPath).toBeTruthy();
      expect(fs.existsSync(first.source.mediaPath!)).toBe(true);
      expect(first.source.checksum).toHaveLength(64); // sha256 hex
    }

    // Same bytes under a different name are still a duplicate.
    const second = importUploadedFile(repos, { ...input, fileName: "renamed.mp3" });
    expect(second.ok).toBe(false);
    if (!second.ok) {
      expect(second.status).toBe(409);
      expect(second.existingSource?.title).toBe("clinical-hours.mp3");
    }
  });

  it("rejects non-media and empty uploads", () => {
    const { repos } = createDatabase(":memory:", { seed: false });
    const pdf = importUploadedFile(repos, {
      fileName: "notes.pdf",
      fileType: "application/pdf",
      bytes: new Uint8Array([1]),
    });
    expect(pdf.ok).toBe(false);
    const empty = importUploadedFile(repos, {
      fileName: "silent.mp3",
      fileType: "audio/mpeg",
      bytes: new Uint8Array([]),
    });
    expect(empty.ok).toBe(false);
  });

  it("deletes retained media after successful transcription (retention policy)", async () => {
    const { repos } = createDatabase(":memory:", { seed: false });
    const uploaded = importUploadedFile(repos, {
      fileName: "shift-notes.mp3",
      fileType: "audio/mpeg",
      bytes: new TextEncoder().encode("retention test bytes"),
    });
    if (!uploaded.ok) throw new Error("upload failed");
    const mediaPath = uploaded.source.mediaPath!;
    expect(fs.existsSync(mediaPath)).toBe(true);

    const result = await processSource(repos, uploaded.source.id, {
      transcriptionProvider: new MockTranscriptionProvider(0),
      extractionProvider: new MockExtractionProvider(),
    });

    expect(result.transcript.segments.length).toBeGreaterThan(0);
    expect(fs.existsSync(mediaPath)).toBe(false);
    expect(repos.sources.getById(uploaded.source.id)?.mediaPath).toBeNull();
  });
});
