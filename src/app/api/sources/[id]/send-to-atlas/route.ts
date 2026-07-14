import { NextResponse } from "next/server";
import { z } from "zod";
import { getRepos } from "@/db";
import { jsonError } from "@/lib/api";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Params = Promise<{ id: string }>;

const SendToAtlasSchema = z
  .object({
    claimIds: z.array(z.string()).optional(),
  })
  .optional();

export async function POST(request: Request, segmentData: { params: Params }) {
  const { id } = await segmentData.params;
  const body = await request.json().catch(() => undefined);
  const parsed = SendToAtlasSchema.safeParse(body);
  if (!parsed.success) return jsonError("Invalid send-to-atlas request.", 400);
  const repos = getRepos();
  const source = repos.sources.getById(id);
  if (!source) return jsonError("Source not found.", 404);

  const requestedIds = new Set(parsed.data?.claimIds ?? []);
  const sourceClaims = repos.claims.listBySourceId(id);
  const approved =
    requestedIds.size > 0
      ? sourceClaims.filter((claim) => requestedIds.has(claim.id) && claim.status !== "rejected")
      : sourceClaims.filter((claim) => claim.status === "approved");
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
