import { NextResponse } from "next/server";
import { getRepos } from "@/db";
import { jsonError } from "@/lib/api";
import { deleteMediaFile } from "@/modules/ingestion/media";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Params = Promise<{ id: string }>;

export async function GET(_request: Request, segmentData: { params: Params }) {
  const { id } = await segmentData.params;
  const repos = getRepos();
  const source = repos.sources.getById(id);
  if (!source) return jsonError("Source not found.", 404);
  const transcript = repos.transcripts.getBySourceId(id);
  const claims = repos.claims.listBySourceId(id);
  return NextResponse.json({
    source,
    transcript,
    claims,
    claimCount: claims.length,
  });
}

export async function DELETE(_request: Request, segmentData: { params: Params }) {
  const { id } = await segmentData.params;
  const repos = getRepos();
  const source = repos.sources.getById(id);
  if (!source) return jsonError("Source not found.", 404);
  const claimCount = repos.claims.listBySourceId(id).length;
  deleteMediaFile(source.mediaPath);
  repos.sources.delete(id);
  return NextResponse.json({ deleted: true, claimCount });
}
