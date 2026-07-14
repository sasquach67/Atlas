# Premed Atlas

Premed Atlas turns scattered pre-med advice into structured, source-linked knowledge. Import pasted text or audio/video metadata, run deterministic mock transcription and extraction, review atomic claims, then send approved claims to the Atlas canvas for organizing across 20 pre-med pillars.

The MVP is intentionally local-first: SQLite persistence, repository interfaces for future storage swaps, mock AI by default, and an E2E proof for the full Definition of Done from upload through timestamp trace and export.

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

## Environment

| Variable | Purpose |
| --- | --- |
| `ANTHROPIC_API_KEY` | Enables real extraction through the Anthropic provider. |
| `ATLAS_EXTRACTION_MODEL` | Overrides the extraction model label used by the Anthropic provider. |
| `ATLAS_DB_PATH` | SQLite path. Defaults to `data/atlas.db`; E2E uses `data/e2e.db`. |
| `ATLAS_FORCE_MOCK_AI` | Set to `1` to force deterministic mock extraction even with an API key. |
| `ATLAS_MOCK_DELAY_MS` | Mock transcription delay. Tests use small or zero delays. |
| `ATLAS_SKIP_SEED` | Set to `1` to start with an empty database. |

## Mock vs Real AI

Tests and Playwright always use mock providers, so no API key is required for CI or local verification. The mock transcriber generates deterministic timestamped segments from file metadata, and the mock extractor emits schema-valid claims from transcripts, including the seeded "500 clinical hours" fixture.

With `ANTHROPIC_API_KEY` set and `ATLAS_FORCE_MOCK_AI` unset, extraction uses the Anthropic provider behind the same `ExtractionProvider` interface. The rest of the app still writes through repositories, so provider swaps do not change persistence or UI code.

## Architecture Map

```text
src/lib/types.ts                  Domain types and enum const arrays
src/lib/schema/extraction.ts      Zod AI extraction contract and sanitizer
src/modules/taxonomy/             20 pre-med pillars and keyword classifier
src/modules/transcript/           Mock transcription and pasted transcript parser
src/modules/extraction/           Mock and Anthropic extraction providers
src/modules/ingestion/            Import/process service logic and validation
src/modules/graph/                Pure Atlas layout and graph builders
src/modules/export/               JSON and Markdown export serializers
src/db/                           SQLite open/reset/seed helpers
src/repositories/                 Persistence interfaces and SQLite adapter
src/components/shell/             App shell and page header
src/components/ui/                shadcn/base-ui primitives
src/app/api/                      Thin route handlers over repos/modules
src/app/                          Next.js pages and client islands
e2e/                              Playwright MVP proof and smoke specs
```

## Decision Log

- Standalone product: Premed Atlas is an advice knowledge workspace, not a generic note app.
- Audio-first ingestion: MVP stores file metadata and transcripts, not media bytes.
- Claims are fundamental: the atomic claim is the durable knowledge unit, with source/timestamp traceability.
- Manual review before merge: AI output starts as pending review; users approve, reject, edit, and organize.
- SQLite now, Supabase later: all persistence goes through repository interfaces so storage can swap behind the same contracts.
- KnowledgeItem folded into claims: `itemType` distinguishes advice, warning, evidence, resource, reflection, and concept without a second object model.
