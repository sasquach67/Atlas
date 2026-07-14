import { NextResponse } from "next/server";
import { z } from "zod";
import { getRepos } from "@/db";
import { jsonError, zodError } from "@/lib/api";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const RelationshipPatchSchema = z.object({
  updates: z.array(
    z.object({
      id: z.string().min(1),
      userConfirmed: z.boolean(),
    }),
  ),
});

export async function PATCH(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = RelationshipPatchSchema.safeParse(body);
  if (!parsed.success) return zodError(parsed.error);

  const repos = getRepos();
  const relationships = [];
  for (const update of parsed.data.updates) {
    try {
      relationships.push(
        repos.relationships.update(update.id, { userConfirmed: update.userConfirmed }),
      );
    } catch {
      return jsonError(`Relationship not found: ${update.id}`, 404);
    }
  }
  return NextResponse.json({ relationships });
}
