import type { Claim, NodePosition, Source } from "@/lib/types";
import { PILLARS } from "@/modules/taxonomy";

export const ATLAS_CELL_WIDTH = 900;
export const ATLAS_CELL_HEIGHT = 760;
export const ATLAS_COLUMNS = 5;
export const UNSORTED_REGION_ID = "unsorted-region";
export const UNSORTED_REGION = {
  x: -900,
  y: -120,
  width: 620,
  height: 640,
};

const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

export function sourceNodeId(sourceId: string): string {
  return `source:${sourceId}`;
}

export function pillarNodeId(pillarId: string): string {
  return `pillar:${pillarId}`;
}

export function pillarHubPositions(): Record<string, NodePosition> {
  return Object.fromEntries(
    [...PILLARS]
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((pillar, index) => {
        const col = index % ATLAS_COLUMNS;
        const row = Math.floor(index / ATLAS_COLUMNS);
        return [
          pillar.id,
          {
            x: col * ATLAS_CELL_WIDTH,
            y: row * ATLAS_CELL_HEIGHT,
          },
        ];
      }),
  );
}

export function claimPositionsAround(
  hub: NodePosition,
  claims: Pick<Claim, "id">[],
): Record<string, NodePosition> {
  return Object.fromEntries(
    claims.map((claim, index) => {
      const angle = index * GOLDEN_ANGLE;
      const radius = 170 + 62 * Math.sqrt(index);
      return [
        claim.id,
        {
          x: Math.round(hub.x + Math.cos(angle) * radius),
          y: Math.round(hub.y + Math.sin(angle) * radius),
        },
      ];
    }),
  );
}

export function unsortedRegionLayout(
  sources: Source[],
  claims: Claim[],
): {
  region: typeof UNSORTED_REGION;
  positions: Record<string, NodePosition>;
} {
  const claimsBySource = new Map<string, Claim[]>();
  for (const claim of claims) {
    if (claim.status !== "unsorted" || !claim.sourceId) continue;
    const group = claimsBySource.get(claim.sourceId) ?? [];
    group.push(claim);
    claimsBySource.set(claim.sourceId, group);
  }

  const positions: Record<string, NodePosition> = {};
  let y = UNSORTED_REGION.y + 92;
  for (const source of sources) {
    const sourceClaims = claimsBySource.get(source.id);
    if (!sourceClaims?.length) continue;
    const sourceId = sourceNodeId(source.id);
    positions[sourceId] = {
      x: UNSORTED_REGION.x + UNSORTED_REGION.width / 2 - 120,
      y,
    };
    y += 96;
    for (const claim of sourceClaims) {
      positions[claim.id] = {
        x: UNSORTED_REGION.x + UNSORTED_REGION.width / 2 - 126,
        y,
      };
      y += 88;
    }
    y += 18;
  }

  return {
    region: {
      ...UNSORTED_REGION,
      height: Math.max(UNSORTED_REGION.height, y - UNSORTED_REGION.y + 48),
    },
    positions,
  };
}

export function computeOrganizeTargets(
  claims: Claim[],
  existingPositions: Record<string, NodePosition> = {},
): Record<string, NodePosition> {
  const hubs = pillarHubPositions();
  const claimsByPillar = new Map<string, Claim[]>();
  for (const claim of claims) {
    const group = claimsByPillar.get(claim.pillarId) ?? [];
    group.push(claim);
    claimsByPillar.set(claim.pillarId, group);
  }

  const targets: Record<string, NodePosition> = {};
  for (const [pillarId, group] of claimsByPillar) {
    const hub = hubs[pillarId];
    if (!hub) continue;
    const sorted = [...group].sort((a, b) => {
      const ax = existingPositions[a.id]?.x ?? 0;
      const bx = existingPositions[b.id]?.x ?? 0;
      return ax - bx || a.id.localeCompare(b.id);
    });
    Object.assign(targets, claimPositionsAround(hub, sorted));
  }
  return targets;
}
