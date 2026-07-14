"use client";

import { create } from "zustand";
import { useStoreWithEqualityFn } from "zustand/traditional";
import { temporal, type TemporalState } from "zundo";
import type {
  Claim,
  ClaimSearchFilters,
  NodePosition,
  Relationship,
  SavedLayout,
  Source,
} from "@/lib/types";
import { computeOrganizeTargets, unsortedRegionLayout } from "@/modules/graph/layout";

export type AtlasSelection =
  | { type: "claim"; id: string }
  | { type: "source"; id: string }
  | { type: "pillar"; id: string }
  | null;

export type AtlasInitialData = {
  claims: Claim[];
  relationships: Relationship[];
  sources: Source[];
  layout: SavedLayout | null;
};

type AtlasHistoryState = Pick<AtlasState, "positions" | "claims" | "relationships">;

export type AtlasState = {
  claims: Claim[];
  relationships: Relationship[];
  sources: Source[];
  positions: Record<string, NodePosition>;
  search: string;
  filters: ClaimSearchFilters;
  selection: AtlasSelection;
  collapsedPillars: Set<string>;
  loaded: boolean;
  load: (data: AtlasInitialData) => void;
  setSearch: (search: string) => void;
  setFilters: (filters: ClaimSearchFilters) => void;
  setSelection: (selection: AtlasSelection) => void;
  togglePillar: (pillarId: string) => void;
  updatePosition: (nodeId: string, position: NodePosition) => void;
  setPositions: (positions: Record<string, NodePosition>) => void;
  updateClaim: (claimId: string, patch: Partial<Claim>) => void;
  updateClaims: (updates: Array<{ id: string; patch: Partial<Claim> }>) => void;
  confirmRelationships: (ids: string[]) => void;
  resetLayout: () => Record<string, NodePosition>;
};

function initialPositions(data: AtlasInitialData): Record<string, NodePosition> {
  const unsorted = unsortedRegionLayout(data.sources, data.claims).positions;
  const organizedTargets = computeOrganizeTargets(
    data.claims.filter((claim) => claim.status === "organized"),
  );
  return {
    ...unsorted,
    ...organizedTargets,
    ...(data.layout?.nodePositions ?? {}),
  };
}

function recomputeDefaultPositions(claims: Claim[], sources: Source[]): Record<string, NodePosition> {
  return {
    ...unsortedRegionLayout(sources, claims).positions,
    ...computeOrganizeTargets(claims.filter((claim) => claim.status === "organized")),
  };
}

export const useAtlasStore = create<AtlasState>()(
  temporal(
    (set, get) => ({
      claims: [],
      relationships: [],
      sources: [],
      positions: {},
      search: "",
      filters: {},
      selection: null,
      collapsedPillars: new Set(),
      loaded: false,
      load: (data) =>
        set({
          claims: data.claims,
          relationships: data.relationships,
          sources: data.sources,
          positions: initialPositions(data),
          loaded: true,
          selection: null,
        }),
      setSearch: (search) => set({ search }),
      setFilters: (filters) => set({ filters }),
      setSelection: (selection) => set({ selection }),
      togglePillar: (pillarId) =>
        set((state) => {
          const next = new Set(state.collapsedPillars);
          if (next.has(pillarId)) next.delete(pillarId);
          else next.add(pillarId);
          return { collapsedPillars: next };
        }),
      updatePosition: (nodeId, position) =>
        set((state) => ({
          positions: {
            ...state.positions,
            [nodeId]: position,
          },
        })),
      setPositions: (positions) => set({ positions }),
      updateClaim: (claimId, patch) =>
        set((state) => ({
          claims: state.claims.map((claim) =>
            claim.id === claimId
              ? { ...claim, ...patch, updatedAt: new Date().toISOString() }
              : claim,
          ),
        })),
      updateClaims: (updates) =>
        set((state) => {
          const updatesById = new Map(updates.map((update) => [update.id, update.patch]));
          return {
            claims: state.claims.map((claim) => {
              const patch = updatesById.get(claim.id);
              return patch ? { ...claim, ...patch, updatedAt: new Date().toISOString() } : claim;
            }),
          };
        }),
      confirmRelationships: (ids) =>
        set((state) => {
          const confirmed = new Set(ids);
          return {
            relationships: state.relationships.map((relationship) =>
              confirmed.has(relationship.id)
                ? { ...relationship, userConfirmed: true }
                : relationship,
            ),
          };
        }),
      resetLayout: () => {
        const state = get();
        const positions = recomputeDefaultPositions(state.claims, state.sources);
        set({ positions });
        return positions;
      },
    }),
    {
      partialize: (state): AtlasHistoryState => ({
        positions: state.positions,
        claims: state.claims,
        relationships: state.relationships,
      }),
    },
  ),
);

export function useAtlasTemporal<T>(
  selector: (state: TemporalState<AtlasHistoryState>) => T,
): T {
  return useStoreWithEqualityFn(useAtlasStore.temporal, selector);
}
