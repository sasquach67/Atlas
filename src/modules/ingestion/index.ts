import { z } from "zod";
import {
  CLAIM_STATUSES,
  ITEM_TYPES,
  type Claim,
  type Relationship,
  type Source,
  type SourceType,
  type Transcript,
} from "@/lib/types";
import { sanitizeExtractionResult, type ExtractionResult } from "@/lib/schema/extraction";
import { PILLAR_IDS } from "@/modules/taxonomy";
import {
  djb2Hash,
  getTranscriptionProvider,
  MAX_TRANSCRIPT_CHARS,
  parseTranscriptText,
  type TranscriptionProvider,
} from "@/modules/transcript";
import {
  ExtractionFailedError,
  getExtractionProvider,
  type ExtractionProvider,
} from "@/modules/extraction";
import type { Repositories } from "@/repositories/types";

const textCommon = {
  title: z.string().trim().min(1).max(180).optional(),
  creatorName: z.string().trim().max(120).optional(),
  platform: z.string().trim().max(80).optional(),
  sourceUrl: z.string().trim().url().optional().or(z.literal("")),
};

export const ImportSourceSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("text"),
    text: z.string().min(1),
    ...textCommon,
  }),
  z.object({
    kind: z.literal("file"),
    fileName: z.string().trim().min(1).max(260),
    fileSize: z.number().int().nonnegative(),
    fileType: z.string().trim().min(1).max(120),
    title: z.string().trim().min(1).max(180).optional(),
  }),
  z.object({
    kind: z.literal("note"),
    title: z.string().trim().min(1).max(180),
    text: z.string().min(1),
  }),
]);

export type ImportSourceInput = z.infer<typeof ImportSourceSchema>;

export const ReviewClaimPatchSchema = z
  .object({
    canonicalText: z.string().trim().min(1).max(2000).optional(),
    pillarId: z.enum(PILLAR_IDS as [string, ...string[]]).optional(),
    itemType: z.enum(ITEM_TYPES).optional(),
    status: z.enum(CLAIM_STATUSES).optional(),
  })
  .strict();

export const TranscriptPatchSchema = z
  .object({
    fullText: z.string().min(1).max(MAX_TRANSCRIPT_CHARS).optional(),
    segments: z
      .array(
        z.object({
          startSeconds: z.number().nonnegative(),
          endSeconds: z.number().nonnegative(),
          text: z.string().min(1),
        }),
      )
      .optional(),
  })
  .strict()
  .refine((value) => value.fullText !== undefined || value.segments !== undefined, {
    message: "Provide transcript text or segments to update.",
  });

type ImportResult =
  | { ok: true; source: Source; transcript: Transcript | null; duplicate?: false }
  | { ok: false; status: number; message: string; existingSource?: Source };

function nowIso(): string {
  return new Date().toISOString();
}

function cleanOptional(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function fileSourceType(fileType: string): SourceType | null {
  if (fileType.startsWith("audio/")) return "audio";
  if (fileType.startsWith("video/")) return "video";
  return null;
}

function fileDescription(fileName: string, fileSize: number, fileType: string): string {
  return [
    "Audio is transcribed, media is not retained.",
    `Original file: ${fileName}`,
    `Type: ${fileType}`,
    `Size: ${fileSize} bytes`,
  ].join("\n");
}

function fileMetadataFromSource(source: Source): { name: string; size: number; type: string } {
  const description = source.description ?? "";
  const original = /^Original file:\s*(.+)$/im.exec(description)?.[1]?.trim();
  const type = /^Type:\s*(.+)$/im.exec(description)?.[1]?.trim();
  const size = Number(/^Size:\s*(\d+)\s+bytes$/im.exec(description)?.[1] ?? 0);
  return {
    name: original || source.title,
    size: Number.isFinite(size) ? size : 0,
    type: type || (source.type === "audio" ? "audio/mpeg" : "video/mp4"),
  };
}

function createTranscript(
  repos: Repositories,
  sourceId: string,
  transcript: ReturnType<typeof parseTranscriptText>,
): Transcript {
  return repos.transcripts.create({
    id: crypto.randomUUID(),
    sourceId,
    fullText: transcript.fullText,
    segments: transcript.segments,
    language: transcript.language,
    model: transcript.model,
    editedByUser: false,
  });
}

export function importSource(repos: Repositories, input: ImportSourceInput): ImportResult {
  const importedAt = nowIso();

  if (input.kind === "file") {
    const type = fileSourceType(input.fileType);
    if (!type) {
      return {
        ok: false,
        status: 400,
        message: "Choose an audio or video file so Premed Atlas can transcribe it.",
      };
    }
    const checksum = djb2Hash(input.fileName + input.fileSize).toString(16);
    const existing = repos.sources.findByChecksum(checksum);
    if (existing) {
      return {
        ok: false,
        status: 409,
        message: "This file has already been imported.",
        existingSource: existing,
      };
    }
    const source = repos.sources.create({
      id: crypto.randomUUID(),
      type,
      title: input.title?.trim() || input.fileName,
      creatorName: null,
      platform: null,
      sourceUrl: null,
      durationSeconds: null,
      description: fileDescription(input.fileName, input.fileSize, input.fileType),
      importedAt,
      processingStatus: "queued",
      errorMessage: null,
      checksum,
    });
    return { ok: true, source, transcript: null };
  }

  const text = input.text.trim();
  if (text.length > MAX_TRANSCRIPT_CHARS) {
    return {
      ok: false,
      status: 400,
      message: `Keep pasted text under ${MAX_TRANSCRIPT_CHARS.toLocaleString()} characters for this MVP import.`,
    };
  }

  const source = repos.sources.create({
    id: crypto.randomUUID(),
    type: input.kind === "note" ? "note" : "text",
    title: input.title?.trim() || (input.kind === "note" ? input.title : "Untitled import"),
    creatorName: input.kind === "text" ? cleanOptional(input.creatorName) : null,
    platform: input.kind === "text" ? cleanOptional(input.platform) : null,
    sourceUrl: input.kind === "text" ? cleanOptional(input.sourceUrl) : null,
    durationSeconds: null,
    description: null,
    importedAt,
    processingStatus: "transcript_ready",
    errorMessage: null,
    checksum: null,
  });
  const transcript = createTranscript(repos, source.id, parseTranscriptText(text));
  return { ok: true, source, transcript };
}

function claimFromExtraction(source: Source, extracted: ExtractionResult["claims"][number]): Claim {
  const createdAt = nowIso();
  return {
    id: crypto.randomUUID(),
    sourceId: source.id,
    canonicalText: extracted.canonicalText,
    originalText: extracted.originalText,
    timestampStart: extracted.timestampStart,
    timestampEnd: extracted.timestampEnd,
    itemType: extracted.itemType,
    claimType: extracted.claimType,
    scope: extracted.scope,
    authorityType: extracted.authorityType,
    evidenceLevel: extracted.evidenceLevel,
    verificationStatus: extracted.verificationStatus,
    freshnessStatus: extracted.freshnessStatus,
    confidence: extracted.confidence,
    pillarId: extracted.pillarId,
    topic: extracted.topic,
    tags: extracted.tags,
    suggestedActions: extracted.suggestedActions,
    status: "pending_review",
    createdAt,
    updatedAt: createdAt,
  };
}

function relationshipsFromExtraction(
  result: ExtractionResult,
  claims: Claim[],
): Relationship[] {
  const pairToRelationship = (
    pair: { claimIndexA: number; claimIndexB: number; note: string },
    relationshipType: Relationship["relationshipType"],
  ): Relationship | null => {
    const from = claims[pair.claimIndexA];
    const to = claims[pair.claimIndexB];
    if (!from || !to) return null;
    return {
      id: crypto.randomUUID(),
      fromClaimId: from.id,
      toClaimId: to.id,
      relationshipType,
      note: pair.note,
      userConfirmed: false,
    };
  };

  return [
    ...result.possibleDuplicates.map((pair) => pairToRelationship(pair, "duplicates")),
    ...result.possibleContradictions.map((pair) => pairToRelationship(pair, "contradicts")),
  ].filter((relationship): relationship is Relationship => relationship !== null);
}

export async function processSource(
  repos: Repositories,
  sourceId: string,
  options?: {
    transcriptionProvider?: TranscriptionProvider;
    extractionProvider?: ExtractionProvider;
  },
): Promise<{ source: Source; transcript: Transcript; claims: Claim[]; relationships: Relationship[] }> {
  let source = repos.sources.getById(sourceId);
  if (!source) throw new Error("Source not found");

  let transcript = repos.transcripts.getBySourceId(source.id);
  try {
    if (!transcript) {
      source = repos.sources.update(source.id, {
        processingStatus: "transcribing",
        errorMessage: null,
      });
      const provider = options?.transcriptionProvider ?? getTranscriptionProvider();
      const result = await provider.transcribe(fileMetadataFromSource(source));
      transcript = repos.transcripts.create({
        id: crypto.randomUUID(),
        sourceId: source.id,
        fullText: result.fullText,
        segments: result.segments,
        language: result.language,
        model: result.model,
        editedByUser: false,
      });
    }

    source = repos.sources.update(source.id, {
      processingStatus: "extracting",
      errorMessage: null,
    });
    const extractor = options?.extractionProvider ?? getExtractionProvider();
    const extraction = sanitizeExtractionResult(
      await extractor.extract({
        source: {
          title: source.title,
          creatorName: source.creatorName,
          platform: source.platform,
          type: source.type,
          description: source.description,
        },
        transcript,
      }),
    );

    if (extraction.suggestedTitle && source.title === "Untitled import") {
      source = repos.sources.update(source.id, { title: extraction.suggestedTitle });
    }
    if (extraction.sourceSummary) {
      source = repos.sources.update(source.id, { description: extraction.sourceSummary });
    }

    const sourceForClaims = source;
    const claims = repos.claims.createMany(
      extraction.claims.map((claim) => claimFromExtraction(sourceForClaims, claim)),
    );
    const relationships = relationshipsFromExtraction(extraction, claims);
    for (const relationship of relationships) repos.relationships.create(relationship);
    source = repos.sources.update(source.id, {
      processingStatus: "ready_for_review",
      errorMessage: null,
    });
    return { source, transcript, claims, relationships };
  } catch (error) {
    const retriable = error instanceof ExtractionFailedError ? error.retriable : true;
    repos.sources.update(source.id, {
      processingStatus: "failed",
      errorMessage:
        error instanceof Error
          ? error.message
          : "Premed Atlas could not process this source.",
    });
    if (error instanceof ExtractionFailedError) throw error;
    throw new ExtractionFailedError(
      error instanceof Error ? error.message : "Premed Atlas could not process this source.",
      retriable,
    );
  }
}
