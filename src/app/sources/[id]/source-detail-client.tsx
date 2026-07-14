"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { RefreshCw, Trash2 } from "lucide-react";
import type { TranscriptSegment } from "@/lib/types";
import { formatTimestamp } from "@/lib/format";
import { Button } from "@/components/ui/button";
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
