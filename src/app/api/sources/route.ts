import { NextResponse } from "next/server";
import { getRepos } from "@/db";
import { jsonError, zodError } from "@/lib/api";
import { ImportSourceSchema, importSource } from "@/modules/ingestion";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const repos = getRepos();
  const sources = repos.sources.list().map((source) => {
    const claims = repos.claims.listBySourceId(source.id);
    return {
      ...source,
      claimCount: claims.length,
      approvedCount: claims.filter((claim) => claim.status === "approved").length,
      pendingReviewCount: claims.filter((claim) => claim.status === "pending_review").length,
    };
  });
  return NextResponse.json({ sources });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = ImportSourceSchema.safeParse(body);
  if (!parsed.success) return zodError(parsed.error);

  const result = importSource(getRepos(), parsed.data);
  if (!result.ok) {
    return jsonError(result.message, result.status, {
      existingSource: result.existingSource,
    });
  }
  return NextResponse.json(
    { source: result.source, transcript: result.transcript },
    { status: 201 },
  );
}
