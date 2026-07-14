"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, FileAudio2, RefreshCw, Send, Upload } from "lucide-react";
import type { ProcessingStatus, Source } from "@/lib/types";
import { humanize } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type SourceWithCounts = Source & {
  claimCount: number;
  approvedCount: number;
  pendingReviewCount: number;
};

const PROCESSING_STATUSES: ProcessingStatus[] = ["queued", "transcribing", "extracting"];

async function readError(response: Response): Promise<string> {
  const data = (await response.json().catch(() => null)) as { error?: string } | null;
  return data?.error ?? "Something went wrong.";
}

function StatusSteps({ status }: { status: ProcessingStatus }) {
  const steps: ProcessingStatus[] = ["queued", "transcribing", "extracting", "ready_for_review"];
  const activeIndex = Math.max(0, steps.indexOf(status));
  return (
    <div className="flex flex-wrap gap-1.5">
      {steps.map((step, index) => (
        <Badge
          key={step}
          variant={index <= activeIndex ? "secondary" : "outline"}
          className="rounded-md"
        >
          {humanize(step)}
        </Badge>
      ))}
    </div>
  );
}

export function InboxClient({ initialSources }: { initialSources: SourceWithCounts[] }) {
  const [sources, setSources] = useState(initialSources);
  const [text, setText] = useState("");
  const [title, setTitle] = useState("");
  const [creatorName, setCreatorName] = useState("");
  const [platform, setPlatform] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [submittingText, setSubmittingText] = useState(false);
  const [submittingFile, setSubmittingFile] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const processing = useMemo(
    () =>
      sources.filter(
        (source) =>
          PROCESSING_STATUSES.includes(source.processingStatus) ||
          source.processingStatus === "failed",
      ),
    [sources],
  );
  const ready = useMemo(
    () => sources.filter((source) => source.processingStatus === "ready_for_review"),
    [sources],
  );
  const shouldPoll = processing.some((source) =>
    PROCESSING_STATUSES.includes(source.processingStatus),
  );

  async function refreshSources() {
    const response = await fetch("/api/sources", { cache: "no-store" });
    if (!response.ok) throw new Error(await readError(response));
    const data = (await response.json()) as { sources: SourceWithCounts[] };
    setSources(data.sources);
  }

  async function startProcessing(sourceId: string) {
    const response = await fetch(`/api/sources/${sourceId}/process`, { method: "POST" });
    if (!response.ok) {
      throw new Error(await readError(response));
    }
    await refreshSources();
  }

  async function submitText() {
    if (!text.trim()) {
      toast.error("Paste transcript text before importing.");
      return;
    }
    setSubmittingText(true);
    try {
      const response = await fetch("/api/sources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "text",
          title: title || undefined,
          creatorName: creatorName || undefined,
          platform: platform || undefined,
          sourceUrl: sourceUrl || undefined,
          text,
        }),
      });
      if (!response.ok) throw new Error(await readError(response));
      const data = (await response.json()) as { source: Source };
      setText("");
      setTitle("");
      setCreatorName("");
      setPlatform("");
      setSourceUrl("");
      toast.success("Import created. Extraction is running.");
      await refreshSources();
      void startProcessing(data.source.id).catch((error) => toast.error(error.message));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Import failed.");
    } finally {
      setSubmittingText(false);
    }
  }

  async function submitFile() {
    const file = fileInputRef.current?.files?.[0];
    if (!file) {
      toast.error("Choose an audio or video file first.");
      return;
    }
    setSubmittingFile(true);
    try {
      const form = new FormData();
      form.append("file", file);
      if (title) form.append("title", title);
      const response = await fetch("/api/sources", {
        method: "POST",
        body: form,
      });
      if (!response.ok) throw new Error(await readError(response));
      const data = (await response.json()) as { source: Source };
      if (fileInputRef.current) fileInputRef.current.value = "";
      toast.success("File uploaded. Transcription is running.");
      await refreshSources();
      void startProcessing(data.source.id).catch((error) => toast.error(error.message));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "File import failed.");
    } finally {
      setSubmittingFile(false);
    }
  }

  async function retry(sourceId: string) {
    toast.message("Retrying processing...");
    try {
      await startProcessing(sourceId);
      toast.success("Processing finished.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Retry failed.");
    }
  }

  useEffect(() => {
    if (!shouldPoll) return;
    const id = window.setInterval(() => {
      void refreshSources().catch(() => undefined);
    }, 1500);
    return () => window.clearInterval(id);
  }, [shouldPoll]);

  return (
    <div className="grid gap-6 px-6 py-8 md:px-10 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
      <section className="grid gap-4" aria-labelledby="import-heading">
        <Card className="rounded-lg">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Upload className="size-4 text-primary" strokeWidth={1.75} />
              <CardTitle id="import-heading">Import</CardTitle>
            </div>
            <CardDescription>
              Paste advice text or upload an audio/video file. Media is stored only until the
              transcript is saved, then deleted.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid gap-3 md:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="source-title">Title</Label>
                <Input
                  id="source-title"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="Optional source title"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="source-platform">Platform</Label>
                <Input
                  id="source-platform"
                  value={platform}
                  onChange={(event) => setPlatform(event.target.value)}
                  placeholder="TikTok, YouTube, Reddit..."
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="source-creator">Creator</Label>
                <Input
                  id="source-creator"
                  value={creatorName}
                  onChange={(event) => setCreatorName(event.target.value)}
                  placeholder="@creator or organization"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="source-url">Source URL</Label>
                <Input
                  id="source-url"
                  value={sourceUrl}
                  onChange={(event) => setSourceUrl(event.target.value)}
                  placeholder="https://..."
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="paste-transcript">Paste text or transcript</Label>
              <Textarea
                id="paste-transcript"
                value={text}
                onChange={(event) => setText(event.target.value)}
                rows={9}
                placeholder="[0:18] You need at least 500 clinical hours..."
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" onClick={submitText} disabled={submittingText}>
                <Send className="size-4" strokeWidth={1.75} />
                {submittingText ? "Importing" : "Import pasted text"}
              </Button>
            </div>
            <div className="rounded-lg border border-dashed border-border bg-muted/30 p-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                <div className="grid gap-2">
                  <Label htmlFor="file-import">Audio/video file</Label>
                  <Input
                    id="file-import"
                    ref={fileInputRef}
                    type="file"
                    accept="audio/*,video/*"
                  />
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={submitFile}
                  disabled={submittingFile}
                >
                  <FileAudio2 className="size-4" strokeWidth={1.75} />
                  {submittingFile ? "Uploading" : "Upload and transcribe"}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      <aside className="grid content-start gap-4">
        <Card className="rounded-lg">
          <CardHeader>
            <CardTitle>Processing</CardTitle>
            <CardDescription>Queued, transcribing, extracting, and failed imports.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            {processing.length === 0 ? (
              <p className="rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground">
                Nothing is processing right now.
              </p>
            ) : (
              processing.map((source) => (
                <div key={source.id} className="grid gap-2 rounded-lg border bg-background p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium leading-snug">{source.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {source.platform ?? humanize(source.type)}
                      </p>
                    </div>
                    {source.processingStatus === "failed" ? (
                      <Badge variant="destructive">Failed</Badge>
                    ) : (
                      <RefreshCw className="mt-0.5 size-4 animate-spin text-muted-foreground" />
                    )}
                  </div>
                  {source.processingStatus === "failed" ? (
                    <div className="grid gap-2">
                      <p className="text-sm text-destructive">
                        {source.errorMessage ?? "Processing failed."}
                      </p>
                      <Button size="sm" variant="outline" onClick={() => retry(source.id)}>
                        <RefreshCw className="size-3.5" strokeWidth={1.75} />
                        Retry
                      </Button>
                    </div>
                  ) : (
                    <StatusSteps status={source.processingStatus} />
                  )}
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="rounded-lg">
          <CardHeader>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="size-4 text-primary" strokeWidth={1.75} />
              <CardTitle>Ready For Review</CardTitle>
            </div>
            <CardDescription>Approve, reject, and organize extracted claims.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            {ready.length === 0 ? (
              <p className="rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground">
                Imports will appear here after extraction.
              </p>
            ) : (
              ready.map((source) => (
                <div key={source.id} className="grid gap-3 rounded-lg border bg-background p-3">
                  <div>
                    <p className="font-medium leading-snug">{source.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {source.pendingReviewCount} pending of {source.claimCount} claims
                    </p>
                  </div>
                  <Link
                    href={`/inbox/review/${source.id}`}
                    className={cn(buttonVariants({ variant: "outline", size: "sm" }), "w-fit")}
                  >
                    Review claims
                  </Link>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </aside>
    </div>
  );
}
