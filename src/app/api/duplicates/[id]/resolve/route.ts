import { NextResponse } from "next/server";
import { z } from "zod";
import { getRepos } from "@/db";
import { jsonError, zodError } from "@/lib/api";
import { markGuideStaleForClaim } from "@/modules/guides";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Params = Promise<{ id: string }>;

const ResolveSchema = z.object({
  action: z.enum(["merge", "keep_both", "dismiss", "undo_merge"]),
  /** For undo_merge: the claim whose pre-merge status should be restored. */
  restoreClaimId: z.string().optional(),
  restoreStatus: z.enum(["pending_review", "approved", "unsorted", "organized"]).optional(),
});

/**
 * Resolves a duplicate suggestion (spec 17.4 — human-controlled, reversible):
 * - merge: higher-confidence claim survives; the other is rejected but kept in
 *   the database with its source link, so provenance is never lost.
 * - keep_both: retyped to related_to ("similar but distinct").
 * - dismiss: suggestion deleted.
 * - undo_merge: restores the rejected claim and un-confirms the relationship.
 */
export async function POST(request: Request, segmentData: { params: Params }) {
  const { id } = await segmentData.params;
  const repos = getRepos();
  const relationship = repos.relationships.list().find((rel) => rel.id === id);
  if (!relationship || relationship.relationshipType !== "duplicates") {
    return jsonError("Duplicate suggestion not found.", 404);
  }

  const body = await request.json().catch(() => null);
  const parsed = ResolveSchema.safeParse(body);
  if (!parsed.success) return zodError(parsed.error);

  const from = repos.claims.getById(relationship.fromClaimId);
  const to = repos.claims.getById(relationship.toClaimId);
  if (!from || !to) return jsonError("One of the claims no longer exists.", 409);

  switch (parsed.data.action) {
    case "merge": {
      const [survivor, merged] = from.confidence >= to.confidence ? [from, to] : [to, from];
      const previousStatus = merged.status;
      repos.claims.update(merged.id, { status: "rejected" });
      if (previousStatus === "organized") markGuideStaleForClaim(repos, merged);
      repos.relationships.update(id, {
        userConfirmed: true,
        // Point survivor -> merged so the trail reads "X supersedes Y".
        fromClaimId: survivor.id,
        toClaimId: merged.id,
        note: relationship.note
          ? `${relationship.note} · merged by user`
          : "merged by user",
      });
      return NextResponse.json({
        resolved: "merge",
        survivorId: survivor.id,
        mergedId: merged.id,
        undo: { restoreClaimId: merged.id, restoreStatus: previousStatus },
      });
    }
    case "undo_merge": {
      const { restoreClaimId, restoreStatus } = parsed.data;
      if (!restoreClaimId || !restoreStatus) {
        return jsonError("undo_merge needs restoreClaimId and restoreStatus.", 400);
      }
      const restored = repos.claims.update(restoreClaimId, { status: restoreStatus });
      repos.relationships.update(id, { userConfirmed: false });
      if (restoreStatus === "organized") markGuideStaleForClaim(repos, restored);
      return NextResponse.json({ resolved: "undo_merge" });
    }
    case "keep_both": {
      repos.relationships.update(id, {
        relationshipType: "related_to",
        userConfirmed: true,
        note: relationship.note
          ? `${relationship.note} · similar but distinct`
          : "similar but distinct",
      });
      return NextResponse.json({ resolved: "keep_both" });
    }
    case "dismiss": {
      repos.relationships.delete(id);
      return NextResponse.json({ resolved: "dismiss" });
    }
  }
}
