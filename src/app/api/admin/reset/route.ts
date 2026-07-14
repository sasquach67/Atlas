import { NextResponse } from "next/server";
import { resetToSeedData } from "@/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST() {
  resetToSeedData();
  return NextResponse.json({ reset: true });
}
