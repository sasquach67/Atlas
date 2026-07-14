import type { TranscriptSegment } from "@/lib/types";

/**
 * Transcription abstraction (spec E.33). The MVP ships only the mock
 * implementation — real speech-to-text is a later provider swap. Pasted
 * transcripts and text are parsed for real by `parseTranscriptText`.
 */

export interface TranscriptInput {
  fullText: string;
  segments: TranscriptSegment[];
  language: string | null;
  model: string | null;
}

export interface TranscriptionProvider {
  readonly name: string;
  transcribe(file: { name: string; size: number; type: string }): Promise<TranscriptInput>;
}

/** ~50k chars keeps extraction well inside one model call (spec: short-form content). */
export const MAX_TRANSCRIPT_CHARS = 50_000;

export function djb2Hash(text: string): number {
  let hash = 5381;
  for (let i = 0; i < text.length; i++) {
    hash = ((hash << 5) + hash + text.charCodeAt(i)) >>> 0;
  }
  return hash;
}

const MOCK_SENTENCE_BANK = [
  "Everyone asks how many clinical hours you need, and the honest answer is that quality beats the number every time.",
  "I scribed for two years and the biggest benefit was learning how physicians actually think through a differential.",
  "Do not take a research position just to check a box — committees can tell when you can't explain your own project.",
  "You should ask for letters of recommendation while the professor still remembers your face, not two years later.",
  "My MCAT score went up thirty points on practice exams once I switched from passive content review to daily questions.",
  "Shadowing a primary care doctor taught me more about the day-to-day of medicine than any hospital volunteering did.",
  "Avoid cramming your personal statement the summer you apply; start collecting patient stories in a journal now.",
  "Fee assistance programs exist and too few applicants use them — look into the AAMC program before you pay full price.",
  "A gap year is not a red flag; an unexplained gap year is.",
  "Pick a service activity you would do even if medical schools did not exist, and stay with it for years, not weeks.",
];

/**
 * Deterministic fake transcription: the filename hash picks sentences from a
 * pre-med themed bank and paces them into timestamped segments. The delay
 * makes processing states visible in the UI (spec 36.1 requires them).
 */
export class MockTranscriptionProvider implements TranscriptionProvider {
  readonly name = "mock-transcriber-v1";

  constructor(private delayMs = 1500) {}

  async transcribe(file: {
    name: string;
    size: number;
    type: string;
  }): Promise<TranscriptInput> {
    if (this.delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, this.delayMs));
    }
    const hash = djb2Hash(file.name + String(file.size));
    const sentenceCount = 4 + (hash % 4); // 4-7 sentences
    const segments: TranscriptSegment[] = [];
    let cursor = 0;
    for (let i = 0; i < sentenceCount; i++) {
      const text = MOCK_SENTENCE_BANK[(hash + i * 7) % MOCK_SENTENCE_BANK.length]!;
      const duration = 6 + ((hash >> (i % 8)) % 7); // 6-12s per sentence
      segments.push({ startSeconds: cursor, endSeconds: cursor + duration, text });
      cursor += duration;
    }
    return {
      fullText: segments.map((s) => s.text).join(" "),
      segments,
      language: "en",
      model: this.name,
    };
  }
}

const TIMESTAMP_LINE = /^\s*\[?(\d{1,2}):(\d{2})(?::(\d{2}))?\]?\s*(?:[-–—]\s*)?(.*)$/;

function toSeconds(a: string, b: string, c: string | undefined): number {
  if (c !== undefined) return Number(a) * 3600 + Number(b) * 60 + Number(c);
  return Number(a) * 60 + Number(b);
}

function splitSentences(text: string): string[] {
  return text
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 1);
}

/**
 * Parses pasted transcript text. Lines prefixed with `[MM:SS]`, `MM:SS`, or
 * `[H:MM:SS]` become real timestamped segments. Plain text gets timestamps
 * synthesized by proportional distribution at a ~2.5 words/second speaking
 * rate, flagged with model "paste".
 */
export function parseTranscriptText(raw: string): TranscriptInput {
  const lines = raw.split("\n").map((l) => l.trim()).filter(Boolean);
  const timestamped: { start: number; text: string }[] = [];

  for (const line of lines) {
    const match = TIMESTAMP_LINE.exec(line);
    if (match && match[4]) {
      timestamped.push({
        start: toSeconds(match[1]!, match[2]!, match[3]),
        text: match[4].trim(),
      });
    }
  }

  // Treat as timestamped only if most lines carry a timestamp.
  if (timestamped.length > 0 && timestamped.length >= lines.length * 0.5) {
    const segments: TranscriptSegment[] = timestamped.map((seg, i) => ({
      startSeconds: seg.start,
      endSeconds:
        i + 1 < timestamped.length
          ? timestamped[i + 1]!.start
          : seg.start + Math.max(3, Math.round(seg.text.split(" ").length / 2.5)),
      text: seg.text,
    }));
    return {
      fullText: segments.map((s) => s.text).join(" "),
      segments,
      language: null,
      model: "paste-timestamped",
    };
  }

  const sentences = splitSentences(raw);
  const segments: TranscriptSegment[] = [];
  let cursor = 0;
  for (const sentence of sentences) {
    const duration = Math.max(2, Math.round(sentence.split(" ").length / 2.5));
    segments.push({ startSeconds: cursor, endSeconds: cursor + duration, text: sentence });
    cursor += duration;
  }
  return {
    fullText: sentences.join(" "),
    segments,
    language: null,
    model: "paste",
  };
}

export function getTranscriptionProvider(): TranscriptionProvider {
  const delay = process.env.ATLAS_MOCK_DELAY_MS
    ? Number(process.env.ATLAS_MOCK_DELAY_MS)
    : 1500;
  return new MockTranscriptionProvider(delay);
}
