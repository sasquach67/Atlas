"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  ReactFlow,
  type NodeChange,
  type NodeMouseHandler,
  type NodeTypes,
  useReactFlow,
} from "@xyflow/react";
import { toast } from "sonner";
import {
  ArrowDownAZ,
  RotateCcw,
  Search,
  Undo2,
  Redo2,
  ZoomIn,
} from "lucide-react";
import type { Claim, ClaimSearchFilters, NodePosition, Relationship } from "@/lib/types";
import { humanize } from "@/lib/format";
import { PILLARS } from "@/modules/taxonomy";
import { buildAtlasGraph, type AtlasNode } from "@/modules/graph/build";
import { computeOrganizeTargets } from "@/modules/graph/layout";
import {
  type AtlasInitialData,
  useAtlasStore,
  useAtlasTemporal,
} from "@/stores/atlas-store";
import { Badge } from "@/components/ui/badge";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ClaimCardNode, PillarHubNode, SourceCardNode } from "./node-components";
import { DetailDrawer } from "./detail-drawer";

const nodeTypes = {
  pillarHub: PillarHubNode,
  claimCard: ClaimCardNode,
  sourceCard: SourceCardNode,
} satisfies NodeTypes;

async function readError(response: Response): Promise<string> {
  const data = (await response.json().catch(() => null)) as { error?: string } | null;
  return data?.error ?? "Something went wrong.";
}

async function persistLayout(positions: Record<string, NodePosition>) {
  const response = await fetch("/api/layouts", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ positions }),
  });
  if (!response.ok) throw new Error(await readError(response));
}

async function persistClaimStatuses(claims: Claim[]) {
  const response = await fetch("/api/claims", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      updates: claims.map((claim) => ({
        id: claim.id,
        status: claim.status,
        pillarId: claim.pillarId,
      })),
    }),
  });
  if (!response.ok) throw new Error(await readError(response));
}

async function persistRelationshipConfirmations(relationships: Relationship[]) {
  const response = await fetch("/api/relationships", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      updates: relationships.map((relationship) => ({
        id: relationship.id,
        userConfirmed: relationship.userConfirmed,
      })),
    }),
  });
  if (!response.ok) throw new Error(await readError(response));
}

function Toolbar({
  unsortedClaims,
  onOrganize,
  onUndo,
  onRedo,
  onReset,
}: {
  unsortedClaims: Claim[];
  onOrganize: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onReset: () => void;
}) {
  const search = useAtlasStore((state) => state.search);
  const filters = useAtlasStore((state) => state.filters);
  const setSearch = useAtlasStore((state) => state.setSearch);
  const setFilters = useAtlasStore((state) => state.setFilters);
  const canUndo = useAtlasTemporal((state) => state.pastStates.length > 0);
  const canRedo = useAtlasTemporal((state) => state.futureStates.length > 0);

  function updateFilters(patch: ClaimSearchFilters) {
    setFilters({ ...filters, ...patch });
  }

  return (
    <div className="absolute left-4 right-4 top-4 z-10 flex flex-wrap items-center gap-2 rounded-lg border bg-card/95 p-2 shadow-sm">
      <div className="relative min-w-56 flex-1 md:max-w-xs">
        <Search className="pointer-events-none absolute left-2 top-2 size-4 text-muted-foreground" />
        <Input
          aria-label="Search atlas"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search claims"
          className="pl-8"
        />
      </div>
      <select
        aria-label="Verification filter"
        value={filters.verificationStatus ?? ""}
        onChange={(event) => {
          const value = event.target.value as ClaimSearchFilters["verificationStatus"] | "";
          updateFilters({ verificationStatus: value || undefined });
        }}
        className="h-8 rounded-lg border border-input bg-background px-2 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <option value="">All verification</option>
        {["unverified", "community_supported", "officially_verified", "disputed", "outdated"].map(
          (status) => (
            <option key={status} value={status}>
              {humanize(status)}
            </option>
          ),
        )}
      </select>
      <select
        aria-label="Evidence filter"
        value={filters.evidenceLevel ?? ""}
        onChange={(event) => {
          const value = event.target.value as ClaimSearchFilters["evidenceLevel"] | "";
          updateFilters({ evidenceLevel: value || undefined });
        }}
        className="h-8 rounded-lg border border-input bg-background px-2 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <option value="">All evidence</option>
        {[
          "official",
          "empirical",
          "professional_experience",
          "community_consensus",
          "anecdotal",
          "unknown",
        ].map((level) => (
          <option key={level} value={level}>
            {humanize(level)}
          </option>
        ))}
      </select>
      <Button
        type="button"
        variant="secondary"
        onClick={onOrganize}
        disabled={unsortedClaims.length === 0}
      >
        <ArrowDownAZ className="size-4" strokeWidth={1.75} />
        Organize {unsortedClaims.length} unsorted
      </Button>
      <Button type="button" variant="outline" size="icon" aria-label="Undo" onClick={onUndo} disabled={!canUndo}>
        <Undo2 className="size-4" strokeWidth={1.75} />
      </Button>
      <Button type="button" variant="outline" size="icon" aria-label="Redo" onClick={onRedo} disabled={!canRedo}>
        <Redo2 className="size-4" strokeWidth={1.75} />
      </Button>
      <AlertDialog>
        <AlertDialogTrigger
          render={
            <Button type="button" variant="outline">
              <RotateCcw className="size-4" strokeWidth={1.75} />
              Reset layout
            </Button>
          }
        />
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset the Atlas layout?</AlertDialogTitle>
            <AlertDialogDescription>
              This recomputes all node positions from the default pillar and unsorted layouts.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={onReset}>Reset</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function OrganizeDialog({
  open,
  onOpenChange,
  claims,
  relationships,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  claims: Claim[];
  relationships: Relationship[];
  onConfirm: (acceptedRelationshipIds: string[]) => void;
}) {
  const [accepted, setAccepted] = useState<Set<string>>(new Set());
  const proposed = useMemo(() => {
    const counts = new Map<string, number>();
    for (const claim of claims) counts.set(claim.pillarId, (counts.get(claim.pillarId) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [claims]);
  const lowConfidence = claims.filter((claim) => claim.confidence < 0.6);
  const claimIds = new Set(claims.map((claim) => claim.id));
  const suggestedRelationships = relationships.filter(
    (relationship) =>
      !relationship.userConfirmed &&
      claimIds.has(relationship.fromClaimId) &&
      claimIds.has(relationship.toClaimId),
  );

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) setAccepted(new Set());
    onOpenChange(nextOpen);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Organize {claims.length} Unsorted Claims</DialogTitle>
          <DialogDescription>
            Premed Atlas will move claims into their pillar cells, preserve source links, and confirm
            only the relationship suggestions you accept.
          </DialogDescription>
        </DialogHeader>
        <div className="grid max-h-[60vh] gap-5 overflow-y-auto pr-1">
          <div className="grid gap-2">
            <h3 className="text-sm font-semibold">Proposed Pillar Distribution</h3>
            {proposed.map(([pillarId, count]) => {
              const pillar = PILLARS.find((candidate) => candidate.id === pillarId);
              const width = `${Math.max(12, (count / Math.max(1, claims.length)) * 100)}%`;
              return (
                <div key={pillarId} className="grid gap-1">
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span>{pillar?.name ?? pillarId}</span>
                    <span className="text-muted-foreground">{count}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full"
                      style={{ width, backgroundColor: pillar?.accent }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          <div className="grid gap-2">
            <h3 className="text-sm font-semibold">Low-Confidence Claims</h3>
            {lowConfidence.length === 0 ? (
              <p className="text-sm text-muted-foreground">No claims below 0.60 confidence.</p>
            ) : (
              lowConfidence.map((claim) => (
                <p key={claim.id} className="rounded-md border p-2 text-sm">
                  {claim.confidence.toFixed(2)} - {claim.canonicalText}
                </p>
              ))
            )}
          </div>

          <div className="grid gap-2">
            <h3 className="text-sm font-semibold">Suggested Relationships</h3>
            {suggestedRelationships.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No duplicate or contradiction suggestions for this batch.
              </p>
            ) : (
              suggestedRelationships.map((relationship) => (
                <label
                  key={relationship.id}
                  className="flex gap-3 rounded-md border p-2 text-sm"
                >
                  <input
                    type="checkbox"
                    checked={accepted.has(relationship.id)}
                    onChange={(event) => {
                      const next = new Set(accepted);
                      if (event.target.checked) next.add(relationship.id);
                      else next.delete(relationship.id);
                      setAccepted(next);
                    }}
                  />
                  <span>
                    <span className="font-medium">{humanize(relationship.relationshipType)}</span>
                    {relationship.note ? ` - ${relationship.note}` : null}
                  </span>
                </label>
              ))
            )}
          </div>
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setAccepted(new Set());
              onOpenChange(false);
            }}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={() => {
              onConfirm([...accepted]);
              setAccepted(new Set());
              onOpenChange(false);
            }}
          >
            Organize Claims
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MobileAtlas() {
  const claims = useAtlasStore((state) => state.claims);
  const setSelection = useAtlasStore((state) => state.setSelection);
  return (
    <div className="grid gap-3 px-6 py-6 md:hidden">
      {PILLARS.map((pillar) => {
        const pillarClaims = claims.filter(
          (claim) =>
            claim.pillarId === pillar.id &&
            (claim.status === "unsorted" || claim.status === "organized"),
        );
        return (
          <details key={pillar.id} className="rounded-lg border bg-card p-3">
            <summary className="flex cursor-pointer items-center justify-between gap-3">
              <span className="flex items-center gap-2 font-medium">
                <span className="size-2.5 rounded-full" style={{ backgroundColor: pillar.accent }} />
                {pillar.shortName}
              </span>
              <Badge variant="outline">{pillarClaims.length}</Badge>
            </summary>
            <div className="mt-3 grid gap-2">
              {pillarClaims.length === 0 ? (
                <p className="text-sm text-muted-foreground">No claims yet.</p>
              ) : (
                pillarClaims.map((claim) => (
                  <button
                    key={claim.id}
                    type="button"
                    className="rounded-md border p-3 text-left text-sm hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/50"
                    onClick={() => setSelection({ type: "claim", id: claim.id })}
                  >
                    {claim.canonicalText}
                  </button>
                ))
              )}
            </div>
          </details>
        );
      })}
    </div>
  );
}

function AtlasFlowInner() {
  const reactFlow = useReactFlow<AtlasNode>();
  const claims = useAtlasStore((state) => state.claims);
  const relationships = useAtlasStore((state) => state.relationships);
  const sources = useAtlasStore((state) => state.sources);
  const positions = useAtlasStore((state) => state.positions);
  const search = useAtlasStore((state) => state.search);
  const filters = useAtlasStore((state) => state.filters);
  const collapsedPillars = useAtlasStore((state) => state.collapsedPillars);
  const updatePosition = useAtlasStore((state) => state.updatePosition);
  const setSelection = useAtlasStore((state) => state.setSelection);
  const [organizeOpen, setOrganizeOpen] = useState(false);
  const [isOrganizing, setIsOrganizing] = useState(false);
  const firstPersist = useRef(true);

  const graph = useMemo(
    () =>
      buildAtlasGraph({
        claims,
        relationships,
        sources,
        positions,
        search,
        filters,
        collapsedPillars,
      }),
    [claims, relationships, sources, positions, search, filters, collapsedPillars],
  );
  const unsortedClaims = claims.filter((claim) => claim.status === "unsorted");

  const onNodesChange = useCallback(
    (changes: NodeChange<AtlasNode>[]) => {
      for (const change of changes) {
        if (change.type !== "position" || !change.position) continue;
        const node = graph.nodes.find((candidate) => candidate.id === change.id);
        if (node?.type !== "claimCard" && node?.type !== "sourceCard") continue;
        updatePosition(change.id, change.position);
      }
    },
    [graph.nodes, updatePosition],
  );

  const onNodeClick: NodeMouseHandler<AtlasNode> = useCallback(
    (_event, node) => {
      if (node.type === "claimCard") setSelection({ type: "claim", id: node.id });
      if (node.type === "sourceCard") setSelection({ type: "source", id: node.id });
      if (node.type === "pillarHub" && node.data.pillarId) {
        setSelection({ type: "pillar", id: node.data.pillarId });
      }
    },
    [setSelection],
  );

  async function persistCurrentState() {
    const state = useAtlasStore.getState();
    await Promise.all([persistLayout(state.positions), persistClaimStatuses(state.claims)]);
  }

  async function undo() {
    useAtlasStore.temporal.getState().undo();
    await persistCurrentState().catch((error) => toast.error(error.message));
  }

  async function redo() {
    useAtlasStore.temporal.getState().redo();
    await persistCurrentState().catch((error) => toast.error(error.message));
  }

  async function resetLayout() {
    const positions = useAtlasStore.getState().resetLayout();
    try {
      await persistLayout(positions);
      toast.success("Layout reset.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Layout reset failed.");
    }
  }

  async function organize(acceptedRelationshipIds: string[]) {
    if (isOrganizing || unsortedClaims.length === 0) return;
    setIsOrganizing(true);
    const startState = useAtlasStore.getState();
    const startPositions = { ...startState.positions };
    const startClaims = startState.claims;
    const startRelationships = startState.relationships;
    const targets = computeOrganizeTargets(unsortedClaims, startPositions);
    const temporal = useAtlasStore.temporal.getState();
    temporal.pause();

    await new Promise<void>((resolve) => {
      const started = performance.now();
      const duration = 700;
      const frame = (time: number) => {
        const raw = Math.min(1, (time - started) / duration);
        const eased = raw < 0.5 ? 2 * raw * raw : 1 - Math.pow(-2 * raw + 2, 2) / 2;
        const next = { ...startPositions };
        for (const [id, target] of Object.entries(targets)) {
          const from = startPositions[id] ?? target;
          next[id] = {
            x: Math.round(from.x + (target.x - from.x) * eased),
            y: Math.round(from.y + (target.y - from.y) * eased),
          };
        }
        useAtlasStore.setState({ positions: next });
        if (raw < 1) requestAnimationFrame(frame);
        else resolve();
      };
      requestAnimationFrame(frame);
    });

    useAtlasStore.setState({
      positions: startPositions,
      claims: startClaims,
      relationships: startRelationships,
    });
    temporal.resume();
    const accepted = new Set(acceptedRelationshipIds);
    useAtlasStore.setState((state) => ({
      positions: { ...state.positions, ...targets },
      claims: state.claims.map((claim) =>
        targets[claim.id] ? { ...claim, status: "organized" } : claim,
      ),
      relationships: state.relationships.map((relationship) =>
        accepted.has(relationship.id) ? { ...relationship, userConfirmed: true } : relationship,
      ),
    }));

    const finalState = useAtlasStore.getState();
    try {
      await Promise.all([
        persistLayout(finalState.positions),
        persistClaimStatuses(finalState.claims),
        acceptedRelationshipIds.length
          ? persistRelationshipConfirmations(
              finalState.relationships.filter((relationship) =>
                acceptedRelationshipIds.includes(relationship.id),
              ),
            )
          : Promise.resolve(),
      ]);
      toast.success(`Organized ${unsortedClaims.length} claims into ${new Set(unsortedClaims.map((claim) => claim.pillarId)).size} pillars.`);
      reactFlow.fitView({ duration: 400, padding: 0.2 });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Organize failed.");
    } finally {
      setIsOrganizing(false);
    }
  }

  useEffect(() => {
    if (firstPersist.current) {
      firstPersist.current = false;
      return;
    }
    const id = window.setTimeout(() => {
      void persistLayout(useAtlasStore.getState().positions).catch(() => undefined);
    }, 1000);
    return () => window.clearTimeout(id);
  }, [positions]);

  return (
    <div className="relative hidden h-[calc(100dvh-5.5rem)] min-h-[640px] md:block">
      <Toolbar
        unsortedClaims={unsortedClaims}
        onOrganize={() => setOrganizeOpen(true)}
        onUndo={() => void undo()}
        onRedo={() => void redo()}
        onReset={() => void resetLayout()}
      />
      <ReactFlow
        nodes={graph.nodes}
        edges={graph.edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onNodeClick={onNodeClick}
        fitView
        selectNodesOnDrag={false}
        multiSelectionKeyCode={["Meta", "Shift"]}
        selectionOnDrag
        panOnScroll
        minZoom={0.18}
        maxZoom={1.8}
      >
        <Background variant={BackgroundVariant.Dots} gap={22} size={1.2} color="oklch(0.28 0.02 75 / 0.18)" />
        <MiniMap pannable zoomable nodeStrokeWidth={3} />
        <Controls showInteractive={false} />
      </ReactFlow>
      {isOrganizing ? (
        <div className="absolute bottom-4 left-4 z-10 rounded-lg border bg-card px-3 py-2 text-sm shadow-sm">
          <ZoomIn className="mr-2 inline size-4 animate-pulse" strokeWidth={1.75} />
          Organizing claims...
        </div>
      ) : null}
      <OrganizeDialog
        open={organizeOpen}
        onOpenChange={setOrganizeOpen}
        claims={unsortedClaims}
        relationships={relationships}
        onConfirm={(ids) => void organize(ids)}
      />
    </div>
  );
}

export function AtlasCanvas({ initialData }: { initialData: AtlasInitialData }) {
  const loaded = useAtlasStore((state) => state.loaded);

  useEffect(() => {
    const temporal = useAtlasStore.temporal.getState();
    temporal.pause();
    useAtlasStore.getState().load(initialData);
    temporal.resume();
    temporal.clear();
  }, [initialData]);

  if (!loaded) {
    return (
      <div className="px-6 py-8 md:px-10">
        <div className="rounded-lg border bg-card p-6 text-sm text-muted-foreground">
          Loading Atlas...
        </div>
      </div>
    );
  }

  return (
    <>
      <MobileAtlas />
      <AtlasFlowInner />
      <DetailDrawer />
    </>
  );
}
