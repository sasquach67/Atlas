/**
 * Core domain types for Premed Atlas.
 *
 * Enum values are declared as `as const` arrays so the same lists drive
 * TypeScript unions, Zod schemas (extraction), and SQLite CHECK constraints.
 */

export const SOURCE_TYPES = ["video", "audio", "text", "note"] as const;
export type SourceType = (typeof SOURCE_TYPES)[number];

export const PROCESSING_STATUSES = [
  "uploaded",
  "queued",
  "transcribing",
  "transcript_ready",
  "extracting",
  "ready_for_review",
  "organizing",
  "complete",
  "failed",
] as const;
export type ProcessingStatus = (typeof PROCESSING_STATUSES)[number];

export const ITEM_TYPES = [
  "advice",
  "warning",
  "evidence",
  "resource",
  "reflection",
  "concept",
] as const;
export type ItemType = (typeof ITEM_TYPES)[number];

export const CLAIM_TYPES = [
  "fact",
  "recommendation",
  "opinion",
  "anecdote",
  "strategy",
  "prediction",
  "warning",
] as const;
export type ClaimType = (typeof CLAIM_TYPES)[number];

export const SCOPES = [
  "universal",
  "school_specific",
  "applicant_specific",
  "country_specific",
  "state_specific",
  "cycle_specific",
  "specialty_specific",
  "financial_situation_specific",
  "unknown",
] as const;
export type Scope = (typeof SCOPES)[number];

export const AUTHORITY_TYPES = [
  "premed_student",
  "applicant",
  "accepted_student",
  "medical_student",
  "resident",
  "physician",
  "advisor",
  "admissions_representative",
  "financial_professional",
  "researcher",
  "official_organization",
  "unknown_or_self_reported",
] as const;
export type AuthorityType = (typeof AUTHORITY_TYPES)[number];

export const EVIDENCE_LEVELS = [
  "official",
  "empirical",
  "professional_experience",
  "community_consensus",
  "anecdotal",
  "unknown",
] as const;
export type EvidenceLevel = (typeof EVIDENCE_LEVELS)[number];

export const VERIFICATION_STATUSES = [
  "unverified",
  "community_supported",
  "officially_verified",
  "disputed",
  "outdated",
] as const;
export type VerificationStatus = (typeof VERIFICATION_STATUSES)[number];

export const FRESHNESS_STATUSES = [
  "current",
  "probably_current",
  "possibly_outdated",
  "outdated",
  "superseded",
  "unknown",
] as const;
export type FreshnessStatus = (typeof FRESHNESS_STATUSES)[number];

export const CLAIM_STATUSES = [
  "pending_review",
  "approved",
  "rejected",
  "unsorted",
  "organized",
] as const;
export type ClaimStatus = (typeof CLAIM_STATUSES)[number];

export const RELATIONSHIP_TYPES = [
  "contradicts",
  "duplicates",
  "supports",
  "related_to",
  "derived_from",
] as const;
export type RelationshipType = (typeof RELATIONSHIP_TYPES)[number];

export const ACTION_STATUSES = [
  "open",
  "in_progress",
  "completed",
  "dismissed",
] as const;
export type ActionStatus = (typeof ACTION_STATUSES)[number];

export const ACTION_PRIORITIES = ["low", "medium", "high"] as const;
export type ActionPriority = (typeof ACTION_PRIORITIES)[number];

export interface Source {
  id: string;
  type: SourceType;
  title: string;
  creatorName: string | null;
  platform: string | null;
  sourceUrl: string | null;
  durationSeconds: number | null;
  description: string | null;
  importedAt: string;
  processingStatus: ProcessingStatus;
  errorMessage: string | null;
  checksum: string | null;
  /** Absolute path of retained media bytes; null once retention deletes them. */
  mediaPath: string | null;
}

export interface TranscriptSegment {
  startSeconds: number;
  endSeconds: number;
  text: string;
}

export interface Transcript {
  id: string;
  sourceId: string;
  fullText: string;
  segments: TranscriptSegment[];
  language: string | null;
  model: string | null;
  editedByUser: boolean;
}

export interface SuggestedAction {
  title: string;
  description: string;
}

export interface Claim {
  id: string;
  sourceId: string | null;
  canonicalText: string;
  originalText: string;
  timestampStart: number | null;
  timestampEnd: number | null;
  itemType: ItemType;
  claimType: ClaimType;
  scope: Scope[];
  authorityType: AuthorityType;
  evidenceLevel: EvidenceLevel;
  verificationStatus: VerificationStatus;
  freshnessStatus: FreshnessStatus;
  confidence: number;
  pillarId: string;
  topic: string;
  tags: string[];
  suggestedActions: SuggestedAction[];
  status: ClaimStatus;
  createdAt: string;
  updatedAt: string;
}

export interface Relationship {
  id: string;
  fromClaimId: string;
  toClaimId: string;
  relationshipType: RelationshipType;
  note: string | null;
  userConfirmed: boolean;
}

export interface ActionItem {
  id: string;
  derivedFromClaimId: string | null;
  title: string;
  description: string | null;
  status: ActionStatus;
  priority: ActionPriority;
  dueAt: string | null;
  createdAt: string;
}

export interface NodePosition {
  x: number;
  y: number;
}

export interface SavedLayout {
  id: string;
  name: string;
  nodePositions: Record<string, NodePosition>;
  updatedAt: string;
}

export const GUIDE_STATUSES = ["draft", "current", "stale"] as const;
export type GuideStatus = (typeof GUIDE_STATUSES)[number];

export interface Guide {
  id: string;
  type: "atlas";
  title: string;
  status: GuideStatus;
  version: number;
  generatedAt: string | null;
}

export interface GuideSection {
  id: string;
  guideId: string;
  pillarId: string;
  topic: string;
  sortOrder: number;
  bodyMarkdown: string;
  supportingClaimIds: string[];
  unresolvedContradictionIds: string[];
  generatedAt: string;
  stale: boolean;
}

export interface ClaimSearchFilters {
  pillarId?: string;
  claimType?: ClaimType;
  itemType?: ItemType;
  verificationStatus?: VerificationStatus;
  evidenceLevel?: EvidenceLevel;
  status?: ClaimStatus | ClaimStatus[];
  minConfidence?: number;
  sourceId?: string;
}
