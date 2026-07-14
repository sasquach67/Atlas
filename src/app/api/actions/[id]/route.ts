import { NextResponse } from "next/server";
import { getRepos } from "@/db";
import { jsonError, zodError } from "@/lib/api";
import { ActionPatchSchema } from "@/modules/actions/schema";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Params = Promise<{ id: string }>;

export async function PATCH(request: Request, segmentData: { params: Params }) {
  const { id } = await segmentData.params;
  const body = await request.json().catch(() => null);
  const parsed = ActionPatchSchema.safeParse(body);
  if (!parsed.success) return zodError(parsed.error);
  const repos = getRepos();
  if (!repos.actions.getById(id)) return jsonError("Action not found.", 404);
  const action = repos.actions.update(id, parsed.data);
  return NextResponse.json({ action });
}
