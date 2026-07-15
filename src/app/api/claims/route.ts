import { NextResponse } from "next/server";
import { z } from "zod";
import { getRepos } from "@/db";
import { jsonError, zodError } from "@/lib/api";
import { CLAIM_STATUSES } from "@/lib/types";
import { PILLAR_IDS } from "@/modules/taxonomy";
import { markGuideStaleForClaim } from "@/modules/guides";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const BulkClaimPatchSchema = z.object({
  updates: z.array(
    z
      .object({
        id: z.string().min(1),
        status: z.enum(CLAIM_STATUSES).optional(),
        pillarId: z.enum(PILLAR_IDS as [string, ...string[]]).optional(),
      })
      .strict(),
  ),
});

export async function PATCH(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = BulkClaimPatchSchema.safeParse(body);
  if (!parsed.success) return zodError(parsed.error);

  const repos = getRepos();
  const claims = [];
  for (const update of parsed.data.updates) {
    if (!repos.claims.getById(update.id)) {
      return jsonError(`Claim not found: ${update.id}`, 404);
    }
  }
  for (const { id, ...patch } of parsed.data.updates) {
    const before = repos.claims.getById(id)!;
    const updated = repos.claims.update(id, patch);
    if (before.status === "organized" || updated.status === "organized") {
      markGuideStaleForClaim(repos, before);
      markGuideStaleForClaim(repos, updated);
    }
    claims.push(updated);
  }
  return NextResponse.json({ claims });
}
