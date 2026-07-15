import { NextResponse } from "next/server";
import { getRepos } from "@/db";
import { jsonError, zodError } from "@/lib/api";
import { ReviewClaimPatchSchema } from "@/modules/ingestion";
import { markGuideStaleForClaim } from "@/modules/guides";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Params = Promise<{ id: string }>;

export async function PATCH(request: Request, segmentData: { params: Params }) {
  const { id } = await segmentData.params;
  const body = await request.json().catch(() => null);
  const parsed = ReviewClaimPatchSchema.safeParse(body);
  if (!parsed.success) return zodError(parsed.error);

  const repos = getRepos();
  const before = repos.claims.getById(id);
  if (!before) return jsonError("Claim not found.", 404);
  const claim = repos.claims.update(id, parsed.data);
  // Guide staleness: an organized claim's section (old and new home) is now outdated.
  if (before.status === "organized" || claim.status === "organized") {
    markGuideStaleForClaim(repos, before);
    markGuideStaleForClaim(repos, claim);
  }
  return NextResponse.json({ claim });
}
