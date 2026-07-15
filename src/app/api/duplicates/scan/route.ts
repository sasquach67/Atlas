import { NextResponse } from "next/server";
import { getRepos } from "@/db";
import { jsonError } from "@/lib/api";
import { getSimilarityProvider, scanForDuplicates } from "@/modules/similarity";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST() {
  const repos = getRepos();
  try {
    const provider = getSimilarityProvider(repos.embeddings);
    const result = await scanForDuplicates(repos, provider);
    return NextResponse.json({ ...result, provider: provider.name });
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "Duplicate scan failed.",
      502,
      { retriable: true },
    );
  }
}
