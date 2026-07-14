"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ArrowRight, ListPlus, Save, Trash2 } from "lucide-react";
import type { Claim, Relationship } from "@/lib/types";
import { confidenceLabel, formatTimestamp, humanize } from "@/lib/format";
import { PILLARS } from "@/modules/taxonomy";
import { type AtlasSelection, useAtlasStore } from "@/stores/atlas-store";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";

async function readError(response: Response): Promise<string> {
  const data = (await response.json().catch(() => null)) as { error?: string } | null;
  return data?.error ?? "Something went wrong.";
}

function badgeLine(claim: Claim) {
  return [
    claim.itemType,
    claim.claimType,
    claim.scope.join(", "),
    claim.authorityType,
    claim.evidenceLevel,
    claim.verificationStatus,
    claim.freshnessStatus,
  ];
}

function ClaimDetailForm({
  claim,
  claims,
  relationships,
  setSelection,
  updateClaim,
}: {
  claim: Claim;
  claims: Claim[];
  relationships: Relationship[];
  setSelection: (selection: AtlasSelection) => void;
  updateClaim: (claimId: string, patch: Partial<Claim>) => void;
}) {
  const [canonicalText, setCanonicalText] = useState(claim.canonicalText);
  const [pillarId, setPillarId] = useState(claim.pillarId);
  const [rejectOpen, setRejectOpen] = useState(false);

  const claimRelationships = useMemo(
    () =>
      relationships.filter(
        (relationship) =>
          relationship.fromClaimId === claim.id || relationship.toClaimId === claim.id,
      ),
    [claim.id, relationships],
  );

  async function saveClaim(patch: Partial<Pick<Claim, "canonicalText" | "pillarId" | "status">>) {
    const response = await fetch(`/api/claims/${claim.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (!response.ok) {
      toast.error(await readError(response));
      return;
    }
    const data = (await response.json()) as { claim: Claim };
    updateClaim(claim.id, data.claim);
    toast.success("Claim saved.");
  }

  async function addAction(action: { title: string; description: string }) {
    const response = await fetch("/api/actions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        derivedFromClaimId: claim.id,
        title: action.title,
        description: action.description,
      }),
    });
    if (!response.ok) {
      toast.error(await readError(response));
      return;
    }
    toast.success("Action added.");
  }

  return (
    <>
      <Sheet open onOpenChange={(open) => !open && setSelection(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>Claim Detail</SheetTitle>
            <SheetDescription>
              Trace, edit, reject, or turn this claim into an action.
            </SheetDescription>
          </SheetHeader>
          <div className="grid gap-5 px-4 pb-6">
            <div className="flex flex-wrap gap-1.5">
              {badgeLine(claim).map((value) => (
                <Badge key={value} variant="outline">
                  {humanize(value)}
                </Badge>
              ))}
              <Badge variant="secondary">
                {claim.confidence.toFixed(2)} | {confidenceLabel(claim.confidence)}
              </Badge>
              {claim.timestampStart !== null ? (
                <Badge variant="outline" className="font-mono">
                  {formatTimestamp(claim.timestampStart)}
                </Badge>
              ) : null}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="drawer-canonical">Canonical claim</Label>
              <Textarea
                id="drawer-canonical"
                value={canonicalText}
                onChange={(event) => setCanonicalText(event.target.value)}
                rows={5}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="drawer-pillar">Pillar</Label>
              <select
                id="drawer-pillar"
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
            <Button
              type="button"
              onClick={() => saveClaim({ canonicalText, pillarId })}
              className="w-fit"
            >
              <Save className="size-4" strokeWidth={1.75} />
              Save
            </Button>

            {claim.originalText ? (
              <blockquote className="rounded-md border-l-2 border-primary/40 bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
                {claim.originalText}
              </blockquote>
            ) : null}

            {claim.suggestedActions.length > 0 ? (
              <div className="grid gap-2">
                <h3 className="text-sm font-semibold">Suggested Actions</h3>
                {claim.suggestedActions.map((action) => (
                  <div key={action.title} className="grid gap-2 rounded-lg border p-3">
                    <p className="font-medium">{action.title}</p>
                    <p className="text-sm text-muted-foreground">{action.description}</p>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="w-fit"
                      onClick={() => addAction(action)}
                    >
                      <ListPlus className="size-3.5" strokeWidth={1.75} />
                      Add to Actions
                    </Button>
                  </div>
                ))}
              </div>
            ) : null}

            {claim.sourceId ? (
              <a
                href={`/sources/${claim.sourceId}?t=${claim.timestampStart ?? 0}`}
                className={cn(buttonVariants({ variant: "outline" }), "w-fit")}
              >
                <ArrowRight className="size-4" strokeWidth={1.75} />
                View in source
              </a>
            ) : null}

            {claimRelationships.length > 0 ? (
              <div className="grid gap-2">
                <h3 className="text-sm font-semibold">Relationships</h3>
                {claimRelationships.map((relationship) => {
                  const otherId =
                    relationship.fromClaimId === claim.id
                      ? relationship.toClaimId
                      : relationship.fromClaimId;
                  const other = claims.find((candidate) => candidate.id === otherId);
                  return (
                    <button
                      key={relationship.id}
                      type="button"
                      onClick={() => setSelection({ type: "claim", id: otherId })}
                      className="rounded-lg border p-3 text-left text-sm hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/50"
                    >
                      <span className="font-medium">
                        {humanize(relationship.relationshipType)}:
                      </span>{" "}
                      {other?.canonicalText ?? otherId}
                    </button>
                  );
                })}
              </div>
            ) : null}

            <Button
              type="button"
              variant="destructive"
              className="w-fit"
              onClick={() => setRejectOpen(true)}
            >
              <Trash2 className="size-4" strokeWidth={1.75} />
              Reject claim
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      <AlertDialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reject this claim?</AlertDialogTitle>
            <AlertDialogDescription>
              Rejected claims leave the Atlas canvas but remain traceable in the database.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                void saveClaim({ status: "rejected" });
                setRejectOpen(false);
                setSelection(null);
              }}
            >
              Reject
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export function DetailDrawer() {
  const selection = useAtlasStore((state) => state.selection);
  const setSelection = useAtlasStore((state) => state.setSelection);
  const claims = useAtlasStore((state) => state.claims);
  const relationships = useAtlasStore((state) => state.relationships);
  const updateClaim = useAtlasStore((state) => state.updateClaim);
  const claim =
    selection?.type === "claim"
      ? claims.find((candidate) => candidate.id === selection.id) ?? null
      : null;

  if (!claim) return null;

  return (
    <ClaimDetailForm
      key={claim.id}
      claim={claim}
      claims={claims}
      relationships={relationships}
      setSelection={setSelection}
      updateClaim={updateClaim}
    />
  );
}
