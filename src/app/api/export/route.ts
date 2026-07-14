import { NextResponse } from "next/server";
import { getRepos } from "@/db";
import {
  buildExportData,
  serializeExportJson,
  serializeExportMarkdown,
} from "@/modules/export";
import { jsonError } from "@/lib/api";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const format = url.searchParams.get("format") ?? "json";
  const data = buildExportData(getRepos());

  if (format === "json") {
    return new NextResponse(serializeExportJson(data), {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": "attachment; filename=premed-atlas-export.json",
      },
    });
  }

  if (format === "markdown") {
    return new NextResponse(serializeExportMarkdown(data), {
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        "Content-Disposition": "attachment; filename=premed-atlas-export.md",
      },
    });
  }

  return jsonError("Use format=json or format=markdown.", 400);
}
