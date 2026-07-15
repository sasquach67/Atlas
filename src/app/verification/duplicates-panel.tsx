"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Copy, ScanSearch } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { Claim, ClaimStatus } from "@/lib/types";

export interface DuplicateSuggestion {
  relationshipId: string;
  note: string | null;
  a: ClaimSummary;
  b: ClaimSummary;
}

interface ClaimSummary {
  id: string;
  canonicalText: string;
  confidence: number;
  status: Claim["status"];
  sourceTitle: string | null;
}

async function readError(response: Response): Promise<string> {
  try {
    const data = (await response.json()) as { error?: string };
    return data.error ?? `Request failed (${response.status}).`;
  } catch {
    return `Request failed (${response.status}).`;
  }
}

function ClaimBox({ claim }: { claim: ClaimSummary }) {
  return (
    <div className="min-w-0 flex-1 rounded-md border border-border/70 p-3">
      <p className="text-sm">{claim.canonicalText}</p>
      <p className="mt-1.5 text-xs text-muted-foreground">
        {claim.sourceTitle ?? "No source"} · confidence {claim.confidence.toFixed(2)} ·{" "}
        {claim.status.replace("_", " ")}
      </p>
    </div>
  );
}

export function DuplicatesPanel({ suggestions }: { suggestions: DuplicateSuggestion[] }) {
  const router = useRouter();
  const [scanning, setScanning] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function scan() {
    setScanning(true);
    try {
      const response = await fetch("/api/duplicates/scan", { method: "POST" });
      if (!response.ok) throw new Error(await readError(response));
      const data = (await response.json()) as { suggested: number; scanned: number };
      toast.success(
        data.suggested > 0
          ? `Found ${data.suggested} possible duplicate${data.suggested === 1 ? "" : "s"} across ${data.scanned} claims.`
          : `No new duplicates across ${data.scanned} claims.`,
      );
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Scan failed.");
    } finally {
      setScanning(false);
    }
  }

  async function resolve(
    suggestion: DuplicateSuggestion,
    action: "merge" | "keep_both" | "dismiss",
  ) {
    setBusyId(suggestion.relationshipId);
    try {
      const response = await fetch(`/api/duplicates/${suggestion.relationshipId}/resolve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (!response.ok) throw new Error(await readError(response));
      const data = (await response.json()) as {
        resolved: string;
        undo?: { restoreClaimId: string; restoreStatus: ClaimStatus };
      };
      if (action === "merge" && data.undo) {
        const undo = data.undo;
        toast.success("Merged. The lower-confidence claim was retired (its source link is kept).", {
          duration: 10_000,
          action: {
            label: "Undo",
            onClick: () => {
              void fetch(`/api/duplicates/${suggestion.relationshipId}/resolve`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "undo_merge", ...undo }),
              }).then(() => router.refresh());
            },
          },
        });
      } else if (action === "keep_both") {
        toast.success("Kept both — marked similar but distinct.");
      } else if (action === "dismiss") {
        toast.success("Suggestion dismissed.");
      }
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not resolve suggestion.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Card className="rounded-lg">
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Copy className="size-4 text-primary" strokeWidth={1.75} />
            <CardTitle>Possible duplicates</CardTitle>
            {suggestions.length > 0 ? (
              <Badge variant="secondary">{suggestions.length}</Badge>
            ) : null}
          </div>
          <Button variant="outline" size="sm" onClick={scan} disabled={scanning} className="gap-1.5">
            <ScanSearch className="size-4" strokeWidth={1.75} />
            {scanning ? "Scanning" : "Scan for duplicates"}
          </Button>
        </div>
        <CardDescription>
          Suggestions only — nothing merges without you. Merging keeps the retired claim and its
          source link in the database.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        {suggestions.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No open duplicate suggestions. Run a scan after importing new sources.
          </p>
        ) : (
          suggestions.map((suggestion) => (
            <div key={suggestion.relationshipId} className="rounded-lg border p-3">
              <div className="flex flex-col gap-2 md:flex-row">
                <ClaimBox claim={suggestion.a} />
                <ClaimBox claim={suggestion.b} />
              </div>
              {suggestion.note ? (
                <p className="mt-2 text-xs text-muted-foreground">{suggestion.note}</p>
              ) : null}
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  size="sm"
                  disabled={busyId === suggestion.relationshipId}
                  onClick={() => resolve(suggestion, "merge")}
                >
                  Merge
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busyId === suggestion.relationshipId}
                  onClick={() => resolve(suggestion, "keep_both")}
                >
                  Keep both
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={busyId === suggestion.relationshipId}
                  onClick={() => resolve(suggestion, "dismiss")}
                >
                  Dismiss
                </Button>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
