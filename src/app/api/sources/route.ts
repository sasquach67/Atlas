import { NextResponse } from "next/server";
import { getRepos } from "@/db";
import { jsonError, zodError } from "@/lib/api";
import { ImportSourceSchema, importSource, importUploadedFile } from "@/modules/ingestion";

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
  const contentType = request.headers.get("content-type") ?? "";

  // Multipart = real media upload; JSON = pasted text or note.
  if (contentType.includes("multipart/form-data")) {
    const form = await request.formData().catch(() => null);
    const file = form?.get("file");
    if (!form || !(file instanceof File)) {
      return jsonError("Attach an audio or video file to upload.", 400);
    }
    const title = form.get("title");
    const result = importUploadedFile(getRepos(), {
      fileName: file.name || "upload",
      fileType: file.type || "application/octet-stream",
      title: typeof title === "string" && title.trim() ? title.trim() : undefined,
      bytes: new Uint8Array(await file.arrayBuffer()),
    });
    if (!result.ok) {
      return jsonError(result.message, result.status, {
        existingSource: result.existingSource,
      });
    }
    return NextResponse.json({ source: result.source, transcript: null }, { status: 201 });
  }

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
