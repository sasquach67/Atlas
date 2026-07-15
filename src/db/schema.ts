/**
 * SQLite schema, written in portable SQL (TEXT ids, ISO-8601 TEXT timestamps,
 * JSON TEXT columns) so a Postgres/Supabase adapter can reuse it nearly as-is.
 */
export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS sources (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL DEFAULT 'local',
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  creator_name TEXT,
  platform TEXT,
  source_url TEXT,
  duration_seconds REAL,
  description TEXT,
  imported_at TEXT NOT NULL,
  processing_status TEXT NOT NULL DEFAULT 'uploaded',
  error_message TEXT,
  checksum TEXT,
  media_path TEXT,
  UNIQUE (workspace_id, checksum)
);

CREATE TABLE IF NOT EXISTS transcripts (
  id TEXT PRIMARY KEY,
  source_id TEXT NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
  full_text TEXT NOT NULL,
  segments TEXT NOT NULL DEFAULT '[]',
  language TEXT,
  model TEXT,
  edited_by_user INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_transcripts_source ON transcripts(source_id);

CREATE TABLE IF NOT EXISTS claims (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL DEFAULT 'local',
  source_id TEXT REFERENCES sources(id) ON DELETE CASCADE,
  canonical_text TEXT NOT NULL,
  original_text TEXT NOT NULL,
  timestamp_start REAL,
  timestamp_end REAL,
  item_type TEXT NOT NULL,
  claim_type TEXT NOT NULL,
  scope TEXT NOT NULL DEFAULT '[]',
  authority_type TEXT NOT NULL DEFAULT 'unknown_or_self_reported',
  evidence_level TEXT NOT NULL DEFAULT 'unknown',
  verification_status TEXT NOT NULL DEFAULT 'unverified',
  freshness_status TEXT NOT NULL DEFAULT 'unknown',
  confidence REAL NOT NULL DEFAULT 0.5,
  pillar_id TEXT NOT NULL,
  topic TEXT NOT NULL DEFAULT '',
  tags TEXT NOT NULL DEFAULT '[]',
  suggested_actions TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'pending_review',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_claims_source ON claims(source_id);
CREATE INDEX IF NOT EXISTS idx_claims_pillar ON claims(pillar_id);
CREATE INDEX IF NOT EXISTS idx_claims_status ON claims(status);

CREATE TABLE IF NOT EXISTS relationships (
  id TEXT PRIMARY KEY,
  from_claim_id TEXT NOT NULL REFERENCES claims(id) ON DELETE CASCADE,
  to_claim_id TEXT NOT NULL REFERENCES claims(id) ON DELETE CASCADE,
  relationship_type TEXT NOT NULL,
  note TEXT,
  user_confirmed INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_relationships_from ON relationships(from_claim_id);
CREATE INDEX IF NOT EXISTS idx_relationships_to ON relationships(to_claim_id);

CREATE TABLE IF NOT EXISTS action_items (
  id TEXT PRIMARY KEY,
  derived_from_claim_id TEXT REFERENCES claims(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'open',
  priority TEXT NOT NULL DEFAULT 'medium',
  due_at TEXT,
  created_at TEXT NOT NULL
);

-- Embedding cache for duplicate detection. This is the pgvector seam: on
-- Postgres, vector becomes a pgvector column and cosine moves into SQL.
CREATE TABLE IF NOT EXISTS claim_embeddings (
  claim_id TEXT PRIMARY KEY REFERENCES claims(id) ON DELETE CASCADE,
  model TEXT NOT NULL,
  vector TEXT NOT NULL,
  text_hash TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS saved_layouts (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  node_positions TEXT NOT NULL DEFAULT '{}',
  updated_at TEXT NOT NULL
);
`;
