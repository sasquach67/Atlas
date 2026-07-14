import { NextResponse } from "next/server";
import { getRepos } from "@/db";
import { PILLARS } from "@/modules/taxonomy";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const repos = getRepos();
  const claims = repos.claims.list({ status: ["unsorted", "organized"] });
  const claimIds = new Set(claims.map((claim) => claim.id));
  const relationships = repos.relationships
    .list()
    .filter(
      (relationship) =>
        claimIds.has(relationship.fromClaimId) && claimIds.has(relationship.toClaimId),
    );
  const sourceIds = new Set(
    claims
      .filter((claim) => claim.status === "unsorted")
      .map((claim) => claim.sourceId)
      .filter((id): id is string => Boolean(id)),
  );
  const sources = repos.sources.list().filter((source) => sourceIds.has(source.id));
  return NextResponse.json({
    claims,
    relationships,
    sources,
    layout: repos.layouts.getDefault(),
    pillars: PILLARS,
  });
}
