"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { RefreshCw, Trash2 } from "lucide-react";
import type { Claim, Source, Transcript, TranscriptSegment } from "@/lib/types";
import { formatTimestamp, humanize } from "@/lib/format";
import { PageHeader } from "@/components/shell/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

async function readError(response: Response): Promise<string> {
  const data = (await response.json().catch(() => null)) as { error?: string } | null;
  return data?.error ?? "Request failed.";
}

type SourceDetailPayload = {
  source: Source;
  transcript: Transcript | null;
  claims: Claim[];
};

export function TranscriptSegments({
  segments,
  targetSeconds,
}: {
  segments: TranscriptSegment[];
  targetSeconds: number | null;
}) {
  const refs = useRef<Record<number, HTMLDivElement | null>>({});
  const targetIndex =
    targetSeconds === null
      ? -1
      : segments.findIndex(
          (segment) =>
            segment.startSeconds <= targetSeconds && targetSeconds < segment.endSeconds,
        );

  useEffect(() => {
    if (targetIndex < 0) return;
    refs.current[targetIndex]?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [targetIndex]);

  if (segments.length === 0) {
    return <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">No transcript segments.</p>;
  }

  return (
    <div className="grid max-h-[540px] gap-2 overflow-auto rounded-lg border bg-card p-3">
      {segments.map((segment, index) => {
        const highlighted = index === targetIndex;
        return (
          <div
            key={`${segment.startSeconds}-${segment.text}`}
            ref={(node) => {
              refs.current[index] = node;
            }}
            className={`grid grid-cols-[4.5rem_1fr] gap-3 rounded-md p-2 text-sm ${
              highlighted ? "bg-accent text-accent-foreground" : "bg-background"
            }`}
          >
            <span className="font-mono text-xs text-muted-foreground">
              {formatTimestamp(segment.startSeconds)}
            </span>
            <span>{segment.text}</span>
          </div>
        );
      })}
    </div>
  );
}

export function SourceDetailView({
  source,
  transcript,
  claims,
  targetSeconds,
}: {
  source: Source;
  transcript: Transcript | null;
  claims: Claim[];
  targetSeconds: number | null;
}) {
  return (
    <div>
      <PageHeader
        title={source.title}
        description={`${source.creatorName ?? "Unknown creator"} - ${source.platform ?? source.type}`}
      >
        <SourceActions sourceId={source.id} claimCount={claims.length} />
      </PageHeader>
      <div className="grid gap-6 px-6 py-8 md:px-10 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
        <section className="grid content-start gap-4">
          <Card className="rounded-lg">
            <CardHeader>
              <CardTitle>Metadata</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2 text-sm text-muted-foreground">
              <p>Status: {humanize(source.processingStatus)}</p>
              <p>Imported: {new Date(source.importedAt).toLocaleString()}</p>
              {source.sourceUrl ? (
                <Link href={source.sourceUrl} className="text-primary underline underline-offset-4">
                  Original URL
                </Link>
              ) : null}
              {source.description ? <p>{source.description}</p> : null}
            </CardContent>
          </Card>

          <Card className="rounded-lg">
            <CardHeader>
              <CardTitle>Transcript</CardTitle>
            </CardHeader>
            <CardContent>
              <TranscriptSegments
                segments={transcript?.segments ?? []}
                targetSeconds={targetSeconds}
              />
            </CardContent>
          </Card>
        </section>

        <section className="grid content-start gap-3">
          <h2 className="font-display text-xl font-semibold">Claims</h2>
          {claims.length === 0 ? (
            <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
              No claims are linked to this source yet.
            </p>
          ) : (
            claims.map((claim) => (
              <Link
                key={claim.id}
                href={`/atlas?claim=${claim.id}`}
                className="rounded-lg border bg-card p-4 hover:bg-muted/30"
              >
                <div className="flex flex-wrap gap-1.5">
                  <Badge variant="outline">{humanize(claim.status)}</Badge>
                  <Badge variant="outline">{humanize(claim.verificationStatus)}</Badge>
                  {claim.timestampStart !== null ? (
                    <Badge variant="secondary" className="font-mono">
                      {formatTimestamp(claim.timestampStart)}
                    </Badge>
                  ) : null}
                </div>
                <p className="mt-2 font-medium">{claim.canonicalText}</p>
              </Link>
            ))
          )}
        </section>
      </div>
    </div>
  );
}

export function SourceDetailLoader({
  sourceId,
  targetSeconds,
}: {
  sourceId: string;
  targetSeconds: number | null;
}) {
  const [payload, setPayload] = useState<SourceDetailPayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      for (let attempt = 0; attempt < 20; attempt++) {
        const controller = new AbortController();
        const timeout = window.setTimeout(() => controller.abort(), 1500);
        try {
          const response = await fetch(`/api/sources/${sourceId}?ts=${Date.now()}`, {
            cache: "no-store",
            signal: controller.signal,
          });
          if (response.ok) {
            const data = (await response.json()) as SourceDetailPayload;
            if (!cancelled) setPayload(data);
            return;
          }
        } catch {
          // Freshly-created sources can race server component reads in production mode.
        } finally {
          window.clearTimeout(timeout);
        }
        await new Promise((resolve) => window.setTimeout(resolve, 500));
      }
      if (!cancelled) setError("This source is not available yet. Return to Sources and retry.");
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [sourceId]);

  if (payload) {
    return (
      <SourceDetailView
        source={payload.source}
        transcript={payload.transcript}
        claims={payload.claims}
        targetSeconds={targetSeconds}
      />
    );
  }

  return (
    <div>
      <PageHeader title="Source" description="Loading source details." />
      <p className={`px-6 py-8 text-sm md:px-10 ${error ? "text-destructive" : "text-muted-foreground"}`}>
        {error ?? "Loading source..."}
      </p>
    </div>
  );
}

export function SourceActions({
  sourceId,
  claimCount,
}: {
  sourceId: string;
  claimCount: number;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function reprocess() {
    setBusy(true);
    try {
      const response = await fetch(`/api/sources/${sourceId}/process`, { method: "POST" });
      if (!response.ok) throw new Error(await readError(response));
      toast.success("Reprocessing finished.");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Reprocess failed.");
    } finally {
      setBusy(false);
    }
  }

  async function deleteSource() {
    setBusy(true);
    try {
      const response = await fetch(`/api/sources/${sourceId}`, { method: "DELETE" });
      if (!response.ok) throw new Error(await readError(response));
      toast.success("Source deleted.");
      router.push("/sources");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Delete failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      <AlertDialog>
        <AlertDialogTrigger
          render={
            <Button type="button" variant="outline" disabled={busy}>
              <RefreshCw className="size-4" strokeWidth={1.75} />
              Reprocess
            </Button>
          }
        />
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reprocess this source?</AlertDialogTitle>
            <AlertDialogDescription>
              This keeps existing claims and creates new pending review claims from the current
              transcript. Existing claim count: {claimCount}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={reprocess}>Reprocess</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog>
        <AlertDialogTrigger
          render={
            <Button type="button" variant="destructive" disabled={busy}>
              <Trash2 className="size-4" strokeWidth={1.75} />
              Delete
            </Button>
          }
        />
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this source?</AlertDialogTitle>
            <AlertDialogDescription>
              This deletes the source transcript and {claimCount} linked claims.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={deleteSource}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
