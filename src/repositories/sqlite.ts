import type { Database } from "better-sqlite3";
import type {
  ActionItem,
  Claim,
  ClaimSearchFilters,
  Relationship,
  SavedLayout,
  Source,
  Transcript,
  NodePosition,
} from "@/lib/types";
import type {
  ActionRepository,
  ClaimRepository,
  LayoutRepository,
  RelationshipRepository,
  Repositories,
  SourceRepository,
  TranscriptRepository,
} from "./types";

const DEFAULT_LAYOUT_ID = "default";

type Row = Record<string, unknown>;

function str(row: Row, key: string): string {
  return row[key] as string;
}
function strOrNull(row: Row, key: string): string | null {
  return (row[key] as string | null) ?? null;
}
function numOrNull(row: Row, key: string): number | null {
  const v = row[key];
  return v === null || v === undefined ? null : Number(v);
}
function json<T>(row: Row, key: string, fallback: T): T {
  const raw = row[key];
  if (typeof raw !== "string" || raw === "") return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function rowToSource(row: Row): Source {
  return {
    id: str(row, "id"),
    type: str(row, "type") as Source["type"],
    title: str(row, "title"),
    creatorName: strOrNull(row, "creator_name"),
    platform: strOrNull(row, "platform"),
    sourceUrl: strOrNull(row, "source_url"),
    durationSeconds: numOrNull(row, "duration_seconds"),
    description: strOrNull(row, "description"),
    importedAt: str(row, "imported_at"),
    processingStatus: str(row, "processing_status") as Source["processingStatus"],
    errorMessage: strOrNull(row, "error_message"),
    checksum: strOrNull(row, "checksum"),
  };
}

function rowToTranscript(row: Row): Transcript {
  return {
    id: str(row, "id"),
    sourceId: str(row, "source_id"),
    fullText: str(row, "full_text"),
    segments: json(row, "segments", []),
    language: strOrNull(row, "language"),
    model: strOrNull(row, "model"),
    editedByUser: Number(row["edited_by_user"]) === 1,
  };
}

function rowToClaim(row: Row): Claim {
  return {
    id: str(row, "id"),
    sourceId: strOrNull(row, "source_id"),
    canonicalText: str(row, "canonical_text"),
    originalText: str(row, "original_text"),
    timestampStart: numOrNull(row, "timestamp_start"),
    timestampEnd: numOrNull(row, "timestamp_end"),
    itemType: str(row, "item_type") as Claim["itemType"],
    claimType: str(row, "claim_type") as Claim["claimType"],
    scope: json(row, "scope", []),
    authorityType: str(row, "authority_type") as Claim["authorityType"],
    evidenceLevel: str(row, "evidence_level") as Claim["evidenceLevel"],
    verificationStatus: str(row, "verification_status") as Claim["verificationStatus"],
    freshnessStatus: str(row, "freshness_status") as Claim["freshnessStatus"],
    confidence: Number(row["confidence"]),
    pillarId: str(row, "pillar_id"),
    topic: str(row, "topic"),
    tags: json(row, "tags", []),
    suggestedActions: json(row, "suggested_actions", []),
    status: str(row, "status") as Claim["status"],
    createdAt: str(row, "created_at"),
    updatedAt: str(row, "updated_at"),
  };
}

function rowToRelationship(row: Row): Relationship {
  return {
    id: str(row, "id"),
    fromClaimId: str(row, "from_claim_id"),
    toClaimId: str(row, "to_claim_id"),
    relationshipType: str(row, "relationship_type") as Relationship["relationshipType"],
    note: strOrNull(row, "note"),
    userConfirmed: Number(row["user_confirmed"]) === 1,
  };
}

function rowToAction(row: Row): ActionItem {
  return {
    id: str(row, "id"),
    derivedFromClaimId: strOrNull(row, "derived_from_claim_id"),
    title: str(row, "title"),
    description: strOrNull(row, "description"),
    status: str(row, "status") as ActionItem["status"],
    priority: str(row, "priority") as ActionItem["priority"],
    dueAt: strOrNull(row, "due_at"),
    createdAt: str(row, "created_at"),
  };
}

/** Maps camelCase patch keys to snake_case columns with JSON/bool encoding. */
function buildUpdate(
  table: string,
  id: string,
  patch: Record<string, unknown>,
  columnMap: Record<string, string>,
  jsonKeys: Set<string>,
  boolKeys: Set<string>,
): { sql: string; params: unknown[] } | null {
  const sets: string[] = [];
  const params: unknown[] = [];
  for (const [key, value] of Object.entries(patch)) {
    const column = columnMap[key];
    if (!column || value === undefined) continue;
    sets.push(`${column} = ?`);
    if (jsonKeys.has(key)) params.push(JSON.stringify(value));
    else if (boolKeys.has(key)) params.push(value ? 1 : 0);
    else params.push(value);
  }
  if (sets.length === 0) return null;
  params.push(id);
  return { sql: `UPDATE ${table} SET ${sets.join(", ")} WHERE id = ?`, params };
}

class SqliteSourceRepository implements SourceRepository {
  constructor(private db: Database) {}

  create(source: Source): Source {
    this.db
      .prepare(
        `INSERT INTO sources (id, type, title, creator_name, platform, source_url, duration_seconds, description, imported_at, processing_status, error_message, checksum)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        source.id,
        source.type,
        source.title,
        source.creatorName,
        source.platform,
        source.sourceUrl,
        source.durationSeconds,
        source.description,
        source.importedAt,
        source.processingStatus,
        source.errorMessage,
        source.checksum,
      );
    return source;
  }

  getById(id: string): Source | null {
    const row = this.db.prepare(`SELECT * FROM sources WHERE id = ?`).get(id) as Row | undefined;
    return row ? rowToSource(row) : null;
  }

  list(): Source[] {
    const rows = this.db
      .prepare(`SELECT * FROM sources ORDER BY imported_at DESC`)
      .all() as Row[];
    return rows.map(rowToSource);
  }

  findByChecksum(checksum: string): Source | null {
    const row = this.db
      .prepare(`SELECT * FROM sources WHERE checksum = ?`)
      .get(checksum) as Row | undefined;
    return row ? rowToSource(row) : null;
  }

  update(id: string, patch: Partial<Omit<Source, "id">>): Source {
    const update = buildUpdate(
      "sources",
      id,
      patch,
      {
        type: "type",
        title: "title",
        creatorName: "creator_name",
        platform: "platform",
        sourceUrl: "source_url",
        durationSeconds: "duration_seconds",
        description: "description",
        importedAt: "imported_at",
        processingStatus: "processing_status",
        errorMessage: "error_message",
        checksum: "checksum",
      },
      new Set(),
      new Set(),
    );
    if (update) this.db.prepare(update.sql).run(...update.params);
    const updated = this.getById(id);
    if (!updated) throw new Error(`Source not found: ${id}`);
    return updated;
  }

  delete(id: string): void {
    this.db.prepare(`DELETE FROM sources WHERE id = ?`).run(id);
  }
}

class SqliteTranscriptRepository implements TranscriptRepository {
  constructor(private db: Database) {}

  create(transcript: Transcript): Transcript {
    this.db
      .prepare(
        `INSERT INTO transcripts (id, source_id, full_text, segments, language, model, edited_by_user)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        transcript.id,
        transcript.sourceId,
        transcript.fullText,
        JSON.stringify(transcript.segments),
        transcript.language,
        transcript.model,
        transcript.editedByUser ? 1 : 0,
      );
    return transcript;
  }

  getBySourceId(sourceId: string): Transcript | null {
    const row = this.db
      .prepare(`SELECT * FROM transcripts WHERE source_id = ?`)
      .get(sourceId) as Row | undefined;
    return row ? rowToTranscript(row) : null;
  }

  update(id: string, patch: Partial<Omit<Transcript, "id" | "sourceId">>): Transcript {
    const update = buildUpdate(
      "transcripts",
      id,
      patch,
      {
        fullText: "full_text",
        segments: "segments",
        language: "language",
        model: "model",
        editedByUser: "edited_by_user",
      },
      new Set(["segments"]),
      new Set(["editedByUser"]),
    );
    if (update) this.db.prepare(update.sql).run(...update.params);
    const row = this.db.prepare(`SELECT * FROM transcripts WHERE id = ?`).get(id) as
      | Row
      | undefined;
    if (!row) throw new Error(`Transcript not found: ${id}`);
    return rowToTranscript(row);
  }

  deleteBySourceId(sourceId: string): void {
    this.db.prepare(`DELETE FROM transcripts WHERE source_id = ?`).run(sourceId);
  }
}

function claimFilterClauses(filters?: ClaimSearchFilters): {
  where: string[];
  params: unknown[];
} {
  const where: string[] = [];
  const params: unknown[] = [];
  if (!filters) return { where, params };
  if (filters.pillarId) {
    where.push("c.pillar_id = ?");
    params.push(filters.pillarId);
  }
  if (filters.claimType) {
    where.push("c.claim_type = ?");
    params.push(filters.claimType);
  }
  if (filters.itemType) {
    where.push("c.item_type = ?");
    params.push(filters.itemType);
  }
  if (filters.verificationStatus) {
    where.push("c.verification_status = ?");
    params.push(filters.verificationStatus);
  }
  if (filters.evidenceLevel) {
    where.push("c.evidence_level = ?");
    params.push(filters.evidenceLevel);
  }
  if (filters.status) {
    const statuses = Array.isArray(filters.status) ? filters.status : [filters.status];
    where.push(`c.status IN (${statuses.map(() => "?").join(", ")})`);
    params.push(...statuses);
  }
  if (filters.minConfidence !== undefined) {
    where.push("c.confidence >= ?");
    params.push(filters.minConfidence);
  }
  if (filters.sourceId) {
    where.push("c.source_id = ?");
    params.push(filters.sourceId);
  }
  return { where, params };
}

class SqliteClaimRepository implements ClaimRepository {
  constructor(private db: Database) {}

  create(claim: Claim): Claim {
    this.db
      .prepare(
        `INSERT INTO claims (id, source_id, canonical_text, original_text, timestamp_start, timestamp_end, item_type, claim_type, scope, authority_type, evidence_level, verification_status, freshness_status, confidence, pillar_id, topic, tags, suggested_actions, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        claim.id,
        claim.sourceId,
        claim.canonicalText,
        claim.originalText,
        claim.timestampStart,
        claim.timestampEnd,
        claim.itemType,
        claim.claimType,
        JSON.stringify(claim.scope),
        claim.authorityType,
        claim.evidenceLevel,
        claim.verificationStatus,
        claim.freshnessStatus,
        claim.confidence,
        claim.pillarId,
        claim.topic,
        JSON.stringify(claim.tags),
        JSON.stringify(claim.suggestedActions),
        claim.status,
        claim.createdAt,
        claim.updatedAt,
      );
    return claim;
  }

  createMany(claims: Claim[]): Claim[] {
    const insert = this.db.transaction((items: Claim[]) => {
      for (const claim of items) this.create(claim);
    });
    insert(claims);
    return claims;
  }

  getById(id: string): Claim | null {
    const row = this.db.prepare(`SELECT * FROM claims WHERE id = ?`).get(id) as Row | undefined;
    return row ? rowToClaim(row) : null;
  }

  list(filters?: ClaimSearchFilters): Claim[] {
    const { where, params } = claimFilterClauses(filters);
    const sql = `SELECT c.* FROM claims c ${
      where.length ? `WHERE ${where.join(" AND ")}` : ""
    } ORDER BY c.created_at ASC, c.id ASC`;
    return (this.db.prepare(sql).all(...params) as Row[]).map(rowToClaim);
  }

  listBySourceId(sourceId: string): Claim[] {
    return this.list({ sourceId });
  }

  search(query: string, filters?: ClaimSearchFilters): Claim[] {
    const { where, params } = claimFilterClauses(filters);
    const q = `%${query.toLowerCase()}%`;
    where.push(
      `(LOWER(c.canonical_text) LIKE ? OR LOWER(c.original_text) LIKE ? OR LOWER(c.topic) LIKE ? OR LOWER(c.tags) LIKE ? OR LOWER(COALESCE(s.title, '')) LIKE ?)`,
    );
    params.push(q, q, q, q, q);
    const sql = `SELECT c.* FROM claims c LEFT JOIN sources s ON s.id = c.source_id WHERE ${where.join(
      " AND ",
    )} ORDER BY c.created_at ASC, c.id ASC`;
    return (this.db.prepare(sql).all(...params) as Row[]).map(rowToClaim);
  }

  update(id: string, patch: Partial<Omit<Claim, "id">>): Claim {
    const withTimestamp = { ...patch, updatedAt: new Date().toISOString() };
    const update = buildUpdate(
      "claims",
      id,
      withTimestamp,
      {
        sourceId: "source_id",
        canonicalText: "canonical_text",
        originalText: "original_text",
        timestampStart: "timestamp_start",
        timestampEnd: "timestamp_end",
        itemType: "item_type",
        claimType: "claim_type",
        scope: "scope",
        authorityType: "authority_type",
        evidenceLevel: "evidence_level",
        verificationStatus: "verification_status",
        freshnessStatus: "freshness_status",
        confidence: "confidence",
        pillarId: "pillar_id",
        topic: "topic",
        tags: "tags",
        suggestedActions: "suggested_actions",
        status: "status",
        createdAt: "created_at",
        updatedAt: "updated_at",
      },
      new Set(["scope", "tags", "suggestedActions"]),
      new Set(),
    );
    if (update) this.db.prepare(update.sql).run(...update.params);
    const updated = this.getById(id);
    if (!updated) throw new Error(`Claim not found: ${id}`);
    return updated;
  }

  delete(id: string): void {
    this.db.prepare(`DELETE FROM claims WHERE id = ?`).run(id);
  }

  countByPillar(): Record<string, number> {
    const rows = this.db
      .prepare(
        `SELECT pillar_id, COUNT(*) as count FROM claims WHERE status != 'rejected' GROUP BY pillar_id`,
      )
      .all() as { pillar_id: string; count: number }[];
    return Object.fromEntries(rows.map((r) => [r.pillar_id, r.count]));
  }
}

class SqliteRelationshipRepository implements RelationshipRepository {
  constructor(private db: Database) {}

  create(relationship: Relationship): Relationship {
    this.db
      .prepare(
        `INSERT INTO relationships (id, from_claim_id, to_claim_id, relationship_type, note, user_confirmed)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(
        relationship.id,
        relationship.fromClaimId,
        relationship.toClaimId,
        relationship.relationshipType,
        relationship.note,
        relationship.userConfirmed ? 1 : 0,
      );
    return relationship;
  }

  list(): Relationship[] {
    return (this.db.prepare(`SELECT * FROM relationships`).all() as Row[]).map(
      rowToRelationship,
    );
  }

  listForClaim(claimId: string): Relationship[] {
    const rows = this.db
      .prepare(`SELECT * FROM relationships WHERE from_claim_id = ? OR to_claim_id = ?`)
      .all(claimId, claimId) as Row[];
    return rows.map(rowToRelationship);
  }

  delete(id: string): void {
    this.db.prepare(`DELETE FROM relationships WHERE id = ?`).run(id);
  }
}

class SqliteActionRepository implements ActionRepository {
  constructor(private db: Database) {}

  create(action: ActionItem): ActionItem {
    this.db
      .prepare(
        `INSERT INTO action_items (id, derived_from_claim_id, title, description, status, priority, due_at, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        action.id,
        action.derivedFromClaimId,
        action.title,
        action.description,
        action.status,
        action.priority,
        action.dueAt,
        action.createdAt,
      );
    return action;
  }

  getById(id: string): ActionItem | null {
    const row = this.db.prepare(`SELECT * FROM action_items WHERE id = ?`).get(id) as
      | Row
      | undefined;
    return row ? rowToAction(row) : null;
  }

  list(): ActionItem[] {
    const rows = this.db
      .prepare(
        `SELECT * FROM action_items ORDER BY CASE status WHEN 'open' THEN 0 WHEN 'in_progress' THEN 1 WHEN 'completed' THEN 2 ELSE 3 END, created_at DESC`,
      )
      .all() as Row[];
    return rows.map(rowToAction);
  }

  update(id: string, patch: Partial<Omit<ActionItem, "id">>): ActionItem {
    const update = buildUpdate(
      "action_items",
      id,
      patch,
      {
        derivedFromClaimId: "derived_from_claim_id",
        title: "title",
        description: "description",
        status: "status",
        priority: "priority",
        dueAt: "due_at",
        createdAt: "created_at",
      },
      new Set(),
      new Set(),
    );
    if (update) this.db.prepare(update.sql).run(...update.params);
    const updated = this.getById(id);
    if (!updated) throw new Error(`Action not found: ${id}`);
    return updated;
  }

  delete(id: string): void {
    this.db.prepare(`DELETE FROM action_items WHERE id = ?`).run(id);
  }
}

class SqliteLayoutRepository implements LayoutRepository {
  constructor(private db: Database) {}

  getDefault(): SavedLayout | null {
    const row = this.db
      .prepare(`SELECT * FROM saved_layouts WHERE id = ?`)
      .get(DEFAULT_LAYOUT_ID) as Row | undefined;
    if (!row) return null;
    return {
      id: str(row, "id"),
      name: str(row, "name"),
      nodePositions: json(row, "node_positions", {}),
      updatedAt: str(row, "updated_at"),
    };
  }

  savePositions(positions: Record<string, NodePosition>): SavedLayout {
    const now = new Date().toISOString();
    this.db
      .prepare(
        `INSERT INTO saved_layouts (id, name, node_positions, updated_at)
         VALUES (?, 'Default layout', ?, ?)
         ON CONFLICT(id) DO UPDATE SET node_positions = excluded.node_positions, updated_at = excluded.updated_at`,
      )
      .run(DEFAULT_LAYOUT_ID, JSON.stringify(positions), now);
    return {
      id: DEFAULT_LAYOUT_ID,
      name: "Default layout",
      nodePositions: positions,
      updatedAt: now,
    };
  }

  reset(): void {
    this.db.prepare(`DELETE FROM saved_layouts WHERE id = ?`).run(DEFAULT_LAYOUT_ID);
  }
}

export function createRepositories(db: Database): Repositories {
  return {
    sources: new SqliteSourceRepository(db),
    transcripts: new SqliteTranscriptRepository(db),
    claims: new SqliteClaimRepository(db),
    relationships: new SqliteRelationshipRepository(db),
    actions: new SqliteActionRepository(db),
    layouts: new SqliteLayoutRepository(db),
  };
}
