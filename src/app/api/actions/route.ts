import { NextResponse } from "next/server";
import { getRepos } from "@/db";
import { zodError } from "@/lib/api";
import { ActionCreateSchema } from "@/modules/actions/schema";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({ actions: getRepos().actions.list() });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = ActionCreateSchema.safeParse(body);
  if (!parsed.success) return zodError(parsed.error);
  const action = getRepos().actions.create({
    id: crypto.randomUUID(),
    derivedFromClaimId: parsed.data.derivedFromClaimId ?? null,
    title: parsed.data.title,
    description: parsed.data.description ?? null,
    status: "open",
    priority: parsed.data.priority,
    dueAt: parsed.data.dueAt ?? null,
    createdAt: new Date().toISOString(),
  });
  return NextResponse.json({ action }, { status: 201 });
}
