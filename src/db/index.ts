import DatabaseConstructor, { type Database } from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { SCHEMA_SQL } from "./schema";
import { seedDatabase } from "./seed";
import { createRepositories } from "@/repositories/sqlite";
import type { Repositories } from "@/repositories/types";

/**
 * Opens (once per process) the local SQLite database, applies the schema,
 * and auto-seeds demo content when the database is empty.
 *
 * ATLAS_DB_PATH overrides the location (used by tests/e2e); ":memory:" is
 * supported. ATLAS_SKIP_SEED=1 disables auto-seeding.
 */

const DEFAULT_DB_PATH = path.join(process.cwd(), "data", "atlas.db");

/**
 * The singleton lives on globalThis because Next bundles route handlers and
 * pages as separate module copies within one process: module-level state
 * would yield two SQLite connections (and the pages copy served stale reads
 * under `next start`). One shared connection guarantees read-your-writes
 * across every server context. Same pattern Prisma documents for Next.js.
 */
type DbSingleton = { db: Database; repos: Repositories };

const globalStore = globalThis as typeof globalThis & { __atlasDb?: DbSingleton | null };

export function openDatabase(dbPath: string): Database {
  if (dbPath !== ":memory:") {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  }
  const db = new DatabaseConstructor(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.exec(SCHEMA_SQL);
  applyAdditiveMigrations(db);
  return db;
}

/**
 * CREATE TABLE IF NOT EXISTS doesn't add columns to databases created before
 * a schema change, so new columns are added here (idempotent, additive only).
 */
function applyAdditiveMigrations(db: Database): void {
  ensureColumn(db, "sources", "media_path", "TEXT");
}

function ensureColumn(db: Database, table: string, column: string, ddl: string): void {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
  if (!columns.some((c) => c.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${ddl}`);
  }
}

function isEmpty(db: Database): boolean {
  const row = db.prepare(`SELECT COUNT(*) as count FROM claims`).get() as { count: number };
  return row.count === 0;
}

export function createDatabase(dbPath: string, options?: { seed?: boolean }): {
  db: Database;
  repos: Repositories;
} {
  const db = openDatabase(dbPath);
  const repos = createRepositories(db);
  if (options?.seed !== false && isEmpty(db)) {
    seedDatabase(repos);
  }
  return { db, repos };
}

export function getRepos(): Repositories {
  if (!globalStore.__atlasDb) {
    const dbPath = process.env.ATLAS_DB_PATH || DEFAULT_DB_PATH;
    const seed = process.env.ATLAS_SKIP_SEED !== "1";
    globalStore.__atlasDb = createDatabase(dbPath, { seed });
  }
  return globalStore.__atlasDb.repos;
}

/** Wipes all rows and reseeds. Used by the Settings "reset demo data" action. */
export function resetToSeedData(): void {
  const repos = getRepos();
  const db = globalStore.__atlasDb!.db;
  db.exec(
    `DELETE FROM relationships; DELETE FROM action_items; DELETE FROM claims; DELETE FROM transcripts; DELETE FROM sources; DELETE FROM saved_layouts; DELETE FROM guides; DELETE FROM guide_sections; DELETE FROM claim_embeddings;`,
  );
  seedDatabase(repos);
}
