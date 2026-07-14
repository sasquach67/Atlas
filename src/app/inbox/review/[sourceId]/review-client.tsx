"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, ExternalLink, Save, Send, X } from "lucide-react";
import type { Claim, Source, Transcript } from "@/lib/types";
import { confidenceLabel, formatTimestamp, humanize } from "@/lib/format";
import { cn } from "@/lib/utils";
import { PILLARS } from "@/modules/taxonomy";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

async function readError(response: Response): Promise<string> {
  const data = (await response.json().catch(() => null)) as { error?: string } | null;
  return data?.error ?? "Something went wrong.";
}

function ClaimCard({
  claim,
  onUpdate,
}: {
  claim: Claim;
  onUpdate: (claimId: string, patch: Partial<Pick<Claim, "canonicalText" | "pillarId" | "itemType" | "status">>) => Promise<void>;
}) {
  const [canonicalText, setCanonicalText] = useState(claim.canonicalText);
  const [pillarId, setPillarId] = useState(claim.pillarId);
  const [itemType, setItemType] = useState(claim.itemType);
  const dirty =
    canonicalText !== claim.canonicalText ||
    pillarId !== claim.pillarId ||
    itemType !== claim.itemType;

  async function save() {
    await onUpdate(claim.id, { canonicalText, pillarId, itemType });
  }

  return (
    <Card className="rounded-lg" data-testid={`review-claim-${claim.id}`}>
      <CardHeader>
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant={claim.status === "rejected" ? "destructive" : "secondary"}>
            {humanize(claim.status)}
          </Badge>
          <Badge variant="outline">{humanize(claim.claimType)}</Badge>
          <Badge variant="outline">{humanize(claim.evidenceLevel)}</Badge>
          <Badge variant="outline">{humanize(claim.verificationStatus)}</Badge>
          <Badge variant="outline">
            {claim.confidence.toFixed(2)} | {confidenceLabel(claim.confidence)}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="grid gap-2">
          <Label htmlFor={`canonical-${claim.id}`}>Canonical claim</Label>
          <Textarea
            id={`canonical-${claim.id}`}
            value={canonicalText}
            onChange={(event) => setCanonicalText(event.target.value)}
            rows={3}
          />
        </div>
        {claim.originalText ? (
          <blockquote className="rounded-md border-l-2 border-primary/40 bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
            {claim.originalText}
          </blockquote>
        ) : null}
        <div className="grid gap-3 md:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor={`pillar-${claim.id}`}>Pillar</Label>
            <select
              id={`pillar-${claim.id}`}
              value={pillarId}
              onChange={(event) => setPillarId(event.target.value)}
              className="h-8 rounded-lg border border-input bg-background px-2 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              {PILLARS.map((pillar) => (
                <option key={pillar.id} value={pillar.id}>
                  {pillar.name}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor={`type-${claim.id}`}>Item type</Label>
            <select
              id={`type-${claim.id}`}
              value={itemType}
              onChange={(event) => setItemType(event.target.value as Claim["itemType"])}
              className="h-8 rounded-lg border border-input bg-background px-2 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              {["advice", "warning", "evidence", "resource", "reflection", "concept"].map((type) => (
                <option key={type} value={type}>
                  {humanize(type)}
                </option>
              ))}
            </select>
          </div>
        </div>
      </CardContent>
      <CardFooter className="flex flex-wrap gap-2">
        <Button type="button" size="sm" variant="outline" onClick={save} disabled={!dirty}>
          <Save className="size-3.5" strokeWidth={1.75} />
          Save edits
        </Button>
        <Button
          type="button"
          size="sm"
          variant={claim.status === "approved" ? "secondary" : "outline"}
          onClick={() => onUpdate(claim.id, { status: "approved", canonicalText, pillarId, itemType })}
        >
          <Check className="size-3.5" strokeWidth={1.75} />
          Approve
        </Button>
        <Button
          type="button"
          size="sm"
          variant={claim.status === "rejected" ? "destructive" : "outline"}
          onClick={() => onUpdate(claim.id, { status: "rejected", canonicalText, pillarId, itemType })}
        >
          <X className="size-3.5" strokeWidth={1.75} />
          Reject
        </Button>
      </CardFooter>
    </Card>
  );
}

export function ReviewClient({
  source,
  transcript,
  initialClaims,
}: {
  source: Source;
  transcript: Transcript;
  initialClaims: Claim[];
}) {
  const router = useRouter();
  const [claims, setClaims] = useState(initialClaims);
  const [fullText, setFullText] = useState(transcript.fullText);
  const [savingTranscript, setSavingTranscript] = useState(false);
  const [sending, setSending] = useState(false);
  const [sentCount, setSentCount] = useState<number | null>(null);

  const approvedCount = useMemo(
    () => claims.filter((claim) => claim.status === "approved").length,
    [claims],
  );

  async function updateClaim(
    claimId: string,
    patch: Partial<Pick<Claim, "canonicalText" | "pillarId" | "itemType" | "status">>,
  ) {
    const response = await fetch(`/api/claims/${claimId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (!response.ok) {
      toast.error(await readError(response));
      return;
    }
    const data = (await response.json()) as { claim: Claim };
    setClaims((current) => current.map((claim) => (claim.id === claimId ? data.claim : claim)));
    toast.success("Claim updated.");
  }

  async function saveTranscript() {
    setSavingTranscript(true);
    try {
      const response = await fetch(`/api/transcripts/${transcript.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullText }),
      });
      if (!response.ok) throw new Error(await readError(response));
      toast.success("Transcript saved.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Transcript save failed.");
    } finally {
      setSavingTranscript(false);
    }
  }

  async function approveAll() {
    const active = claims.filter((claim) => claim.status !== "rejected");
    await Promise.all(active.map((claim) => updateClaim(claim.id, { status: "approved" })));
  }

  async function sendToAtlas() {
    setSending(true);
    try {
      const response = await fetch(`/api/sources/${source.id}/send-to-atlas`, { method: "POST" });
      if (!response.ok) throw new Error(await readError(response));
      const data = (await response.json()) as { count: number };
      setSentCount(data.count);
      toast.success(`Sent ${data.count} approved claims to Atlas.`);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Send to Atlas failed.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="grid gap-6 px-6 py-8 md:px-10 xl:grid-cols-[minmax(320px,0.9fr)_minmax(0,1.1fr)]">
      <section className="grid content-start gap-4">
        <Card className="rounded-lg">
          <CardHeader>
            <CardTitle>Transcript</CardTitle>
            <CardDescription>
              Edit the source transcript before accepting claims. Segment timestamps are preserved
              from the current transcript.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="max-h-[360px] overflow-auto rounded-lg border bg-background">
              {transcript.segments.map((segment) => (
                <button
                  key={`${segment.startSeconds}-${segment.text}`}
                  type="button"
                  className="grid w-full grid-cols-[4.5rem_1fr] gap-3 border-b px-3 py-2 text-left text-sm last:border-b-0 hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  <span className="font-mono text-xs text-muted-foreground">
                    {formatTimestamp(segment.startSeconds)}
                  </span>
                  <span>{segment.text}</span>
                </button>
              ))}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="transcript-full-text">Full transcript</Label>
              <Textarea
                id="transcript-full-text"
                value={fullText}
                onChange={(event) => setFullText(event.target.value)}
                rows={9}
              />
            </div>
            <Button type="button" variant="outline" onClick={saveTranscript} disabled={savingTranscript}>
              <Save className="size-4" strokeWidth={1.75} />
              {savingTranscript ? "Saving" : "Save transcript"}
            </Button>
          </CardContent>
        </Card>
        <Card className="rounded-lg">
          <CardHeader>
            <CardTitle>Source</CardTitle>
            <CardDescription>{source.title}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2 text-sm text-muted-foreground">
            <p>{source.creatorName ?? "Unknown creator"}</p>
            <p>{source.platform ?? humanize(source.type)}</p>
            {source.sourceUrl ? (
              <Link
                href={source.sourceUrl}
                target="_blank"
                className={cn(buttonVariants({ variant: "link" }), "h-auto w-fit p-0")}
              >
                <ExternalLink className="size-3.5" strokeWidth={1.75} />
                Original source
              </Link>
            ) : null}
          </CardContent>
        </Card>
      </section>

      <section className="grid content-start gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card p-4">
          <div>
            <h2 className="font-display text-xl font-semibold">Claims</h2>
            <p className="text-sm text-muted-foreground">
              {approvedCount} approved of {claims.length} extracted claims
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={approveAll}>
              <Check className="size-4" strokeWidth={1.75} />
              Approve all
            </Button>
            <Button type="button" onClick={sendToAtlas} disabled={approvedCount === 0 || sending}>
              <Send className="size-4" strokeWidth={1.75} />
              {sending ? "Sending" : `Send ${approvedCount} approved claims to Atlas`}
            </Button>
            {sentCount !== null ? (
              <Link href="/atlas" className={buttonVariants({ variant: "secondary" })}>
                Open Atlas
              </Link>
            ) : null}
          </div>
        </div>
        {claims.length === 0 ? (
          <p className="rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground">
            No claims were extracted from this source.
          </p>
        ) : (
          claims.map((claim) => (
            <ClaimCard key={claim.id} claim={claim} onUpdate={updateClaim} />
          ))
        )}
      </section>
    </div>
  );
}
