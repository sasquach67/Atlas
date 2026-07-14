import { NextResponse } from "next/server";
import { getRepos } from "@/db";
import { jsonError } from "@/lib/api";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Params = Promise<{ id: string }>;

export async function POST(_request: Request, segmentData: { params: Params }) {
  const { id } = await segmentData.params;
  const repos = getRepos();
  const source = repos.sources.getById(id);
  if (!source) return jsonError("Source not found.", 404);

  const approved = repos.claims
    .listBySourceId(id)
    .filter((claim) => claim.status === "approved");
  for (const claim of approved) {
    repos.claims.update(claim.id, { status: "unsorted" });
  }
  const updatedSource = repos.sources.update(id, { processingStatus: "complete" });
  return NextResponse.json({
    source: updatedSource,
    count: approved.length,
    claims: approved.map((claim) => ({ ...claim, status: "unsorted" })),
  });
}
