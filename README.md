# Premed Atlas

Premed Atlas turns scattered pre-med advice into structured, source-linked knowledge. Import pasted text or upload audio/video, get a timestamped transcript, review AI-extracted atomic claims, organize them across 20 pre-med pillars on the Atlas canvas, resolve duplicate suggestions, and synthesize everything into a cited, regenerable guide.

The app is local-first: SQLite persistence, repository interfaces for future storage swaps, deterministic mock AI by default, and Playwright proofs for the full workflows — upload through timestamp trace, duplicate resolution, and guide generation.

## Quickstart

```bash
npm i
npm run dev
```

Open http://localhost:3000. The app auto-creates `data/atlas.db` and seeds demo data unless `ATLAS_SKIP_SEED=1` is set.

Useful checks:

```bash
npm run lint
npm run typecheck
npm test
npm run build
npm run test:e2e
```

## AI providers

Every AI capability sits behind a provider interface with a deterministic mock, selected by environment. Tests and Playwright always use the mocks — no API key is ever required for CI or local verification. The Settings page shows which path each capability is using.

| Capability | Mock (default) | Real provider | Enabled by |
| --- | --- | --- | --- |
| Claim extraction | Heuristic sentence classifier + seeded fixture | Claude (`claude-opus-4-8`) structured outputs | `ANTHROPIC_API_KEY` |
| Guide synthesis | Templated cited markdown | Claude structured outputs | `ANTHROPIC_API_KEY` |
| Transcription | Deterministic segments from file identity | OpenAI `whisper-1` (verbose_json segments) | `OPENAI_API_KEY` |
| Duplicate detection | Token-set Jaccard overlap | OpenAI `text-embedding-3-small` + cached vectors | `OPENAI_API_KEY` |

`ATLAS_FORCE_MOCK_AI=1` pins every capability to its mock even when keys are present.

## Environment

| Variable | Purpose |
| --- | --- |
| `ANTHROPIC_API_KEY` | Enables real claim extraction and guide synthesis (Claude). |
| `OPENAI_API_KEY` | Enables real transcription (Whisper) and embedding-based duplicate detection. |
| `ATLAS_EXTRACTION_MODEL` | Overrides the Claude model used for extraction and guide synthesis. |
| `ATLAS_DB_PATH` | SQLite path. Defaults to `data/atlas.db`; E2E uses `data/e2e.db`. |
| `ATLAS_MEDIA_DIR` | Where uploaded media is stored temporarily. Defaults to `data/media`. |
| `ATLAS_FORCE_MOCK_AI` | Set to `1` to force deterministic mock AI everywhere. |
| `ATLAS_MOCK_DELAY_MS` | Mock transcription delay. Tests use small or zero delays. |
| `ATLAS_SKIP_SEED` | Set to `1` to start with an empty database. |

## Media retention

Uploads are real: bytes land in `data/media`, are deduplicated by SHA-256 content checksum, and are **deleted automatically once the transcript is saved** (spec Section 31). Transcripts, claims, and source metadata are what the app keeps long-term. Reprocessing a source whose media has been deleted re-extracts from the stored transcript instead of re-transcribing.

## Guides

The Premed Atlas Guide is synthesized hierarchically: organized claims group into pillar chapters and topic sections; each section is generated independently and cites its claims with `[^claimId]` markers rendered as traceable chips (claim → source → timestamp). Output that cites claims it wasn't given is rejected. Editing, merging, or reorganizing a claim marks only the affected sections stale, and regeneration rebuilds just those.

## Architecture Map

```text
src/lib/types.ts                  Domain types and enum const arrays
src/lib/schema/extraction.ts      Zod AI extraction contract and sanitizer
src/modules/taxonomy/             20 pre-med pillars and keyword classifier
src/modules/transcript/           Transcription providers (mock + Whisper) and transcript parser
src/modules/extraction/           Mock and Anthropic extraction providers
src/modules/similarity/           Similarity providers (Jaccard + embeddings), duplicate scan
src/modules/guides/               Guide synthesis providers, pipeline, staleness
src/modules/ingestion/            Import/upload/process service logic and media retention
src/modules/graph/                Pure Atlas layout and graph builders
src/modules/export/               JSON and Markdown export serializers
src/modules/ai-status.ts          Per-capability provider status for Settings
src/db/                           SQLite open/migrate/reset/seed helpers
src/repositories/                 Persistence interfaces and SQLite adapter
src/components/shell/             App shell and page header
src/components/ui/                shadcn/base-ui primitives
src/app/api/                      Thin route handlers over repos/modules
src/app/                          Next.js pages and client islands
e2e/                              Playwright proofs: MVP, upload, duplicates, guides
```

## Decision Log

- Standalone product: Premed Atlas is an advice knowledge workspace, not a generic note app.
- Audio-first ingestion: media is stored only until its transcript is saved, then deleted; transcripts and claims are the durable record.
- Claims are fundamental: the atomic claim is the durable knowledge unit, with source/timestamp traceability.
- Manual review before merge: AI output starts as pending review; duplicate suggestions never auto-merge, and merges are reversible with provenance kept.
- Guides are regenerable syntheses, not chat output: section-level versioning, staleness, and citation integrity checks (uncited or foreign-cited output is rejected).
- SQLite now, Supabase later: all persistence goes through repository interfaces; the embedding cache is the pgvector seam.
- KnowledgeItem folded into claims: `itemType` distinguishes advice, warning, evidence, resource, reflection, and concept without a second object model.
