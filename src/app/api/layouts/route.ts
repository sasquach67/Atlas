import { NextResponse } from "next/server";
import { z } from "zod";
import { getRepos } from "@/db";
import { zodError } from "@/lib/api";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const PositionsSchema = z.object({
  positions: z.record(
    z.string(),
    z.object({
      x: z.number(),
      y: z.number(),
    }),
  ),
});

export async function PUT(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = PositionsSchema.safeParse(body);
  if (!parsed.success) return zodError(parsed.error);
  const layout = getRepos().layouts.savePositions(parsed.data.positions);
  return NextResponse.json({ layout });
}

export async function DELETE() {
  getRepos().layouts.reset();
  return NextResponse.json({ reset: true });
}
