"use client";

import { Handle, Position, type NodeProps } from "@xyflow/react";
import { AlertTriangle, BookOpen, FileText } from "lucide-react";
import type { AtlasNode } from "@/modules/graph/build";
import { confidenceLabel, formatTimestamp, humanize } from "@/lib/format";
import { useAtlasStore } from "@/stores/atlas-store";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

function NodeHandles() {
  return (
    <>
      <Handle type="target" position={Position.Top} className="opacity-0" />
      <Handle type="source" position={Position.Bottom} className="opacity-0" />
      <Handle type="target" position={Position.Left} className="opacity-0" />
      <Handle type="source" position={Position.Right} className="opacity-0" />
    </>
  );
}

export function PillarHubNode({ data, id }: NodeProps<AtlasNode>) {
  const setSelection = useAtlasStore((state) => state.setSelection);
  return (
    <div
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === "Enter") setSelection({ type: "pillar", id: data.pillarId ?? id });
      }}
      className="grid min-h-24 w-56 place-items-center rounded-lg border bg-card px-4 py-3 text-center shadow-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      style={{ borderColor: data.accent }}
    >
      <NodeHandles />
      <div className="mb-2 size-3 rounded-full" style={{ backgroundColor: data.accent }} />
      <p className="font-display text-base font-semibold leading-tight">{data.label}</p>
      <p className="mt-1 text-xs text-muted-foreground">{data.count ?? 0} claims</p>
    </div>
  );
}

export function SourceCardNode({ data, id }: NodeProps<AtlasNode>) {
  const setSelection = useAtlasStore((state) => state.setSelection);
  return (
    <div
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === "Enter") setSelection({ type: "source", id });
      }}
      className="w-60 rounded-lg border bg-card p-3 shadow-md outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      <NodeHandles />
      <div className="mb-2 flex items-center gap-2 text-muted-foreground">
        <FileText className="size-4" strokeWidth={1.75} />
        <span className="text-xs font-medium uppercase tracking-wide">Unsorted source</span>
      </div>
      <p className="line-clamp-2 text-sm font-semibold leading-snug">{data.label}</p>
      <p className="mt-2 text-xs text-muted-foreground">{data.count ?? 0} claim chips</p>
    </div>
  );
}

export function ClaimCardNode({ data, id }: NodeProps<AtlasNode>) {
  const claim = data.claim;
  const setSelection = useAtlasStore((state) => state.setSelection);
  if (!claim) return null;
  return (
    <div
      tabIndex={0}
      data-testid={`claim-node-${claim.id}`}
      onKeyDown={(event) => {
        if (event.key === "Enter") setSelection({ type: "claim", id });
      }}
      className={cn(
        "w-64 rounded-lg border bg-card p-3 text-sm shadow-sm outline-none transition-shadow focus-visible:ring-3 focus-visible:ring-ring/50",
        data.conflict && "border-destructive/70",
      )}
      style={{ borderColor: data.conflict ? undefined : data.accent }}
    >
      <NodeHandles />
      <div className="mb-2 flex items-center justify-between gap-2">
        <Badge variant={claim.status === "unsorted" ? "outline" : "secondary"}>
          {humanize(claim.status)}
        </Badge>
        {data.conflict ? (
          <AlertTriangle className="size-4 text-destructive" strokeWidth={1.75} />
        ) : (
          <BookOpen className="size-4 text-muted-foreground" strokeWidth={1.75} />
        )}
      </div>
      <p className="line-clamp-4 leading-snug">{claim.canonicalText}</p>
      <div className="mt-3 flex flex-wrap gap-1.5">
        <Badge variant="outline">{humanize(claim.itemType)}</Badge>
        <Badge variant="outline">{claim.confidence.toFixed(2)} {confidenceLabel(claim.confidence)}</Badge>
        {claim.timestampStart !== null ? (
          <Badge variant="outline" className="font-mono">
            {formatTimestamp(claim.timestampStart)}
          </Badge>
        ) : null}
      </div>
    </div>
  );
}
