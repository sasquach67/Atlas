import type {
  ActionItem,
  Claim,
  ClaimSearchFilters,
  Guide,
  GuideSection,
  Relationship,
  SavedLayout,
  Source,
  Transcript,
  NodePosition,
} from "@/lib/types";

/**
 * Repository interfaces isolate persistence. The MVP implementation is
 * SQLite (better-sqlite3); a Supabase/Postgres adapter can implement the
 * same interfaces later without touching modules or UI.
 */

export interface SourceRepository {
  create(source: Source): Source;
  getById(id: string): Source | null;
  list(): Source[];
  findByChecksum(checksum: string): Source | null;
  update(id: string, patch: Partial<Omit<Source, "id">>): Source;
  delete(id: string): void;
}

export interface TranscriptRepository {
  create(transcript: Transcript): Transcript;
  getBySourceId(sourceId: string): Transcript | null;
  update(id: string, patch: Partial<Omit<Transcript, "id" | "sourceId">>): Transcript;
  deleteBySourceId(sourceId: string): void;
}

export interface ClaimRepository {
  create(claim: Claim): Claim;
  createMany(claims: Claim[]): Claim[];
  getById(id: string): Claim | null;
  list(filters?: ClaimSearchFilters): Claim[];
  listBySourceId(sourceId: string): Claim[];
  search(query: string, filters?: ClaimSearchFilters): Claim[];
  update(id: string, patch: Partial<Omit<Claim, "id">>): Claim;
  delete(id: string): void;
  countByPillar(): Record<string, number>;
}

export interface RelationshipRepository {
  create(relationship: Relationship): Relationship;
  list(): Relationship[];
  listForClaim(claimId: string): Relationship[];
  update(id: string, patch: Partial<Omit<Relationship, "id">>): Relationship;
  delete(id: string): void;
}

export interface ActionRepository {
  create(action: ActionItem): ActionItem;
  getById(id: string): ActionItem | null;
  list(): ActionItem[];
  update(id: string, patch: Partial<Omit<ActionItem, "id">>): ActionItem;
  delete(id: string): void;
}

export interface GuideRepository {
  getAtlasGuide(): Guide | null;
  upsertAtlasGuide(patch: Partial<Omit<Guide, "id" | "type">>): Guide;
  listSections(guideId: string): GuideSection[];
  replaceSection(section: GuideSection): void;
  deleteSectionsNotIn(guideId: string, keepIds: string[]): void;
  markSectionsStale(guideId: string, pillarId: string, topic?: string): number;
}

export interface EmbeddingRepository {
  getMany(claimIds: string[]): { claimId: string; model: string; vector: number[]; textHash: string }[];
  upsert(embedding: { claimId: string; model: string; vector: number[]; textHash: string }): void;
}

export interface LayoutRepository {
  getDefault(): SavedLayout | null;
  savePositions(positions: Record<string, NodePosition>): SavedLayout;
  reset(): void;
}

export interface Repositories {
  sources: SourceRepository;
  transcripts: TranscriptRepository;
  claims: ClaimRepository;
  relationships: RelationshipRepository;
  actions: ActionRepository;
  layouts: LayoutRepository;
  embeddings: EmbeddingRepository;
  guides: GuideRepository;
}
