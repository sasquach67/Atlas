import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

/**
 * Temporary media storage (spec Section 31): uploaded bytes live in
 * data/media only until transcription succeeds, then retention deletes them.
 * Transcripts, claims, and metadata are what we keep long-term.
 */

const MEDIA_DIR_ENV = "ATLAS_MEDIA_DIR";

export const MAX_UPLOAD_BYTES = 100 * 1024 * 1024;

export function mediaDir(): string {
  return process.env[MEDIA_DIR_ENV] || path.join(process.cwd(), "data", "media");
}

export function sha256(bytes: Uint8Array): string {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

export function saveMediaFile(sourceId: string, fileName: string, bytes: Uint8Array): string {
  const ext = path.extname(fileName).slice(0, 10) || ".bin";
  const dir = mediaDir();
  fs.mkdirSync(dir, { recursive: true });
  const filePath = path.join(dir, `${sourceId}${ext}`);
  fs.writeFileSync(filePath, bytes);
  return filePath;
}

/** Best-effort delete; retention must never fail the pipeline. */
export function deleteMediaFile(filePath: string | null): void {
  if (!filePath) return;
  try {
    fs.rmSync(filePath, { force: true });
  } catch {
    // Leave orphans for manual cleanup rather than failing processing.
  }
}
