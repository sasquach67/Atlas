import fs from "node:fs";
import path from "node:path";
import type {
  TranscribeFileInput,
  TranscriptInput,
  TranscriptionProvider,
} from "./index";

/**
 * Real speech-to-text via OpenAI Whisper (`whisper-1`, verbose_json), which
 * returns segment-level timestamps that map directly onto TranscriptSegment.
 * Uses plain fetch — no SDK dependency for one endpoint. Server-only.
 */

const OPENAI_TRANSCRIPTION_URL = "https://api.openai.com/v1/audio/transcriptions";
/** Whisper API rejects uploads over 25 MB. */
export const MAX_WHISPER_BYTES = 25 * 1024 * 1024;

interface WhisperVerboseResponse {
  text: string;
  language?: string;
  segments?: { start: number; end: number; text: string }[];
}

export class TranscriptionFailedError extends Error {
  constructor(
    message: string,
    public readonly retriable: boolean,
  ) {
    super(message);
    this.name = "TranscriptionFailedError";
  }
}

export class OpenAiTranscriptionProvider implements TranscriptionProvider {
  readonly name = "openai:whisper-1";

  constructor(private apiKey: string) {}

  async transcribe(file: TranscribeFileInput): Promise<TranscriptInput> {
    if (!file.path) {
      throw new TranscriptionFailedError(
        "The original media file is no longer stored, so it cannot be re-transcribed. The saved transcript is still available.",
        false,
      );
    }
    let stat: fs.Stats;
    try {
      stat = fs.statSync(file.path);
    } catch {
      throw new TranscriptionFailedError(
        "The media file for this source is missing from local storage.",
        false,
      );
    }
    if (stat.size > MAX_WHISPER_BYTES) {
      throw new TranscriptionFailedError(
        "This file is larger than the 25 MB transcription limit. Compress the audio and re-import it.",
        false,
      );
    }

    const form = new FormData();
    form.append("model", "whisper-1");
    form.append("response_format", "verbose_json");
    form.append("timestamp_granularities[]", "segment");
    const blob = new Blob([new Uint8Array(fs.readFileSync(file.path))], {
      type: file.type || "application/octet-stream",
    });
    form.append("file", blob, path.basename(file.name) || "audio");

    let response: Response;
    try {
      response = await fetch(OPENAI_TRANSCRIPTION_URL, {
        method: "POST",
        headers: { Authorization: `Bearer ${this.apiKey}` },
        body: form,
      });
    } catch {
      throw new TranscriptionFailedError(
        "Could not reach the transcription provider. Check your connection and retry.",
        true,
      );
    }

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      if (response.status === 401) {
        throw new TranscriptionFailedError(
          "The OpenAI API key was rejected. Check OPENAI_API_KEY in .env.local.",
          false,
        );
      }
      if (response.status === 429) {
        throw new TranscriptionFailedError(
          "The transcription provider is rate-limiting requests. Wait a minute and retry.",
          true,
        );
      }
      throw new TranscriptionFailedError(
        `Transcription failed (${response.status}): ${detail.slice(0, 300)}`,
        response.status >= 500,
      );
    }

    const data = (await response.json()) as WhisperVerboseResponse;
    const segments = (data.segments ?? []).map((segment) => ({
      startSeconds: segment.start,
      endSeconds: segment.end,
      text: segment.text.trim(),
    }));
    return {
      fullText: data.text?.trim() || segments.map((s) => s.text).join(" "),
      segments,
      language: data.language ?? null,
      model: this.name,
    };
  }
}
