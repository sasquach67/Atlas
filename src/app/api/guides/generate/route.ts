import { NextResponse } from "next/server";
import { z } from "zod";
import { getRepos } from "@/db";
import { jsonError, zodError } from "@/lib/api";
import { generateAtlasGuide, getGuideProvider } from "@/modules/guides";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
// Section-by-section synthesis over a real model can take a while.
export const maxDuration = 300;

const GenerateSchema = z.object({ onlyStale: z.boolean().optional() }).optional();

export async function POST(request: Request) {
  const body = await request.json().catch(() => undefined);
  const parsed = GenerateSchema.safeParse(body ?? {});
  if (!parsed.success) return zodError(parsed.error);

  const repos = getRepos();
  try {
    const provider = getGuideProvider();
    const result = await generateAtlasGuide(repos, provider, {
      onlyStale: parsed.data?.onlyStale,
    });
    return NextResponse.json({ ...result, provider: provider.name });
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "Guide generation failed.",
      502,
      { retriable: true },
    );
  }
}
