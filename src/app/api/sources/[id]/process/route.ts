import { NextResponse } from "next/server";
import { getRepos } from "@/db";
import { jsonError } from "@/lib/api";
import { ExtractionFailedError } from "@/modules/extraction";
import { processSource } from "@/modules/ingestion";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Params = Promise<{ id: string }>;

export async function POST(_request: Request, segmentData: { params: Params }) {
  const { id } = await segmentData.params;
  const repos = getRepos();
  if (!repos.sources.getById(id)) return jsonError("Source not found.", 404);

  try {
    const result = await processSource(repos, id);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof ExtractionFailedError) {
      return jsonError(error.message, 502, { retriable: error.retriable });
    }
    return jsonError(
      error instanceof Error ? error.message : "Premed Atlas could not process this source.",
      500,
      { retriable: true },
    );
  }
}
