import { NextResponse } from "next/server";
import { getRepos } from "@/db";
import { jsonError, zodError } from "@/lib/api";
import { ReviewClaimPatchSchema } from "@/modules/ingestion";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Params = Promise<{ id: string }>;

export async function PATCH(request: Request, segmentData: { params: Params }) {
  const { id } = await segmentData.params;
  const body = await request.json().catch(() => null);
  const parsed = ReviewClaimPatchSchema.safeParse(body);
  if (!parsed.success) return zodError(parsed.error);

  const repos = getRepos();
  if (!repos.claims.getById(id)) return jsonError("Claim not found.", 404);
  const claim = repos.claims.update(id, parsed.data);
  return NextResponse.json({ claim });
}
