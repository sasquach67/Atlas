import { NextResponse } from "next/server";
import { ZodError } from "zod";

export function jsonError(message: string, status = 400, extra?: Record<string, unknown>) {
  return NextResponse.json({ error: message, ...extra }, { status });
}

export function zodError(error: ZodError) {
  return jsonError(error.issues[0]?.message ?? "Invalid request body.", 400, {
    issues: error.issues,
  });
}
