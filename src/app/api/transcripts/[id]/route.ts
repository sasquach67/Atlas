import { NextResponse } from "next/server";
import { getRepos } from "@/db";
import { jsonError, zodError } from "@/lib/api";
import { TranscriptPatchSchema } from "@/modules/ingestion";
import { parseTranscriptText } from "@/modules/transcript";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Params = Promise<{ id: string }>;

export async function PATCH(request: Request, segmentData: { params: Params }) {
  const { id } = await segmentData.params;
  const body = await request.json().catch(() => null);
  const parsed = TranscriptPatchSchema.safeParse(body);
  if (!parsed.success) return zodError(parsed.error);

  const repos = getRepos();
  try {
    const patch =
      parsed.data.fullText && !parsed.data.segments
        ? {
            ...parseTranscriptText(parsed.data.fullText),
            editedByUser: true,
          }
        : {
            ...parsed.data,
            fullText:
              parsed.data.fullText ??
              parsed.data.segments?.map((segment) => segment.text).join(" ") ??
              "",
            editedByUser: true,
          };
    const transcript = repos.transcripts.update(id, patch);
    return NextResponse.json({ transcript });
  } catch {
    return jsonError("Transcript not found.", 404);
  }
}
