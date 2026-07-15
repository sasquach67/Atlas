# Phase 3 Product Truth And Functionality Audit

Date: 2026-07-14
Milestone: M11
Scope: audit only. M12-M14 are intentionally not implemented here.

## Executive Summary

Premed Atlas is no longer a static prototype. The core MVP and Phase 2 workflows are present and test-backed: real/multipart media upload, mock or real transcription selection, claim extraction, review, Atlas organization, duplicate suggestions, guide generation, citation navigation, export, and settings all exist in the repository.

No P0 blocker was found during M11: the full existing gate passes. The largest internal-beta risks are not missing screens; they are truth-in-product gaps where a visible control does not quite complete its implied job or where multi-step persistence can partially succeed:

- Home Quick Import creates a source but does not process it, while Inbox does not show `transcript_ready` sources.
- `/atlas?claim=...` and `/atlas?pillar=...` links are emitted by several pages but ignored by the Atlas route/client.
- Several user-visible mutations are multi-step without a transaction or server-side orchestration boundary.
- `sourceUrl` accepts any URL scheme allowed by `z.string().url()` and external links need tighter handling.
- Route/API negative tests are thinner than module and Playwright coverage.
- Automatic contradiction discovery is not present yet; it remains the explicit M12 scope.

## Evidence Sources

- Handoffs: `AGENTS.md`, `CODEX_HANDOFF.md`, `PHASE2_HANDOFF.md`, `PHASE3_HANDOFF.md`.
- Route tree: `src/app/**/page.tsx`, `src/app/api/**/route.ts`.
- Client controls: `src/app/**/*client.tsx`, `src/app/atlas/atlas-canvas.tsx`, `src/app/atlas/detail-drawer.tsx`, `src/app/guides/**`.
- Providers: `src/modules/transcript`, `src/modules/extraction`, `src/modules/similarity`, `src/modules/guides`, `src/modules/ai-status.ts`.
- Persistence: `src/db/schema.ts`, `src/db/index.ts`, `src/repositories/types.ts`, `src/repositories/sqlite.ts`.
- Tests: `src/**/*.test.ts`, `e2e/*.spec.ts`.

Status labels used below: `working`, `partially_working`, `mock_only`, `placeholder`, `broken`, `unclear`, `future`.

## Gate Output Before Audit Documentation

The existing gate was run before creating this audit document. Outputs:

```text
$ npm run lint && npm run typecheck && npm test

> premed-atlas@0.1.0 lint
> eslint

> premed-atlas@0.1.0 typecheck
> tsc --noEmit

> premed-atlas@0.1.0 test
> vitest run

 RUN  v4.1.10 /Users/andyquach/premed-atlas

 Test Files  7 passed (7)
      Tests  47 passed (47)
   Start at  22:09:44
   Duration  387ms (transform 467ms, setup 0ms, import 802ms, tests 118ms, environment 0ms)
```

```text
$ npm run build && npm run test:e2e

> premed-atlas@0.1.0 build
> next build

▲ Next.js 16.2.10 (Turbopack)

  Creating an optimized production build ...
Turbopack build encountered 1 warnings:
./next.config.ts
Encountered unexpected file in NFT list
A file was traced that indicates that the whole project was traced unintentionally. Somewhere in the import trace below, there are:
- filesystem operations (like path.join, path.resolve or fs.readFile), or
- very dynamic requires (like require('./' + foo)).
To resolve this, you can
- remove them if possible, or
- only use them in development, or
- make sure they are statically scoped to some subfolder: path.join(process.cwd(), 'data', bar), or
- add ignore comments: path.join(/*turbopackIgnore: true*/ process.cwd(), bar)

Import trace:
  App Route:
    ./next.config.ts
    ./src/modules/ingestion/media.ts
    ./src/app/api/sources/[id]/route.ts

✓ Compiled successfully in 2.5s
  Running TypeScript ...
  Finished TypeScript in 3.0s ...
  Collecting page data using 9 workers ...
  Generating static pages using 9 workers (0/3) ...
✓ Generating static pages using 9 workers (3/3) in 69ms
  Finalizing page optimization ...

Route (app)
┌ ƒ /
├ ○ /_not-found
├ ƒ /actions
├ ƒ /api/actions
├ ƒ /api/actions/[id]
├ ƒ /api/admin/reset
├ ƒ /api/atlas
├ ƒ /api/claims
├ ƒ /api/claims/[id]
├ ƒ /api/duplicates/[id]/resolve
├ ƒ /api/duplicates/scan
├ ƒ /api/export
├ ƒ /api/guides/generate
├ ƒ /api/layouts
├ ƒ /api/relationships
├ ƒ /api/sources
├ ƒ /api/sources/[id]
├ ƒ /api/sources/[id]/process
├ ƒ /api/sources/[id]/send-to-atlas
├ ƒ /api/transcripts/[id]
├ ƒ /atlas
├ ƒ /catalog
├ ƒ /guides
├ ƒ /guides/atlas
├ ƒ /inbox
├ ƒ /inbox/review/[sourceId]
├ ƒ /settings
├ ƒ /sources
├ ƒ /sources/[id]
└ ƒ /verification

○  (Static)   prerendered as static content
ƒ  (Dynamic)  server-rendered on demand

> premed-atlas@0.1.0 test:e2e
> playwright test

Running 7 tests using 1 worker

  ✓  1 e2e/atlas.spec.ts:14:7 › atlas canvas › organizes seeded unsorted claims and opens source trace (1.9s)
  ✓  2 e2e/duplicates.spec.ts:5:7 › duplicate detection and resolution › suggests a near-duplicate of an existing claim and merges it with provenance kept (317ms)
  ✓  3 e2e/duplicates.spec.ts:45:7 › duplicate detection and resolution › scan button reports results and dismiss removes a suggestion (193ms)
  ✓  4 e2e/guides.spec.ts:5:7 › guide generation and reading › generates the guide, traces a citation to a timestamped source, and regenerates stale sections (414ms)
  ✓  5 e2e/inbox.spec.ts:5:7 › inbox ingestion smoke › imports pasted advice, reviews claims, and sends approved claims to Atlas (378ms)
  ✓  6 e2e/mvp-proof.spec.ts:7:7 › E.44 MVP proof › walks upload to timestamp trace to export (2.3s)
  ✓  7 e2e/transcription-upload.spec.ts:5:7 › media upload transcription › uploads a real file, transcribes it (mock), and rejects re-upload of the same bytes (641ms)

  7 passed (14.4s)
```

The e2e output also included repeated Node `NO_COLOR`/`FORCE_COLOR` warnings from the test web server. They appear non-fatal.

## Route And Workflow Inventory

### Page Routes

| Route | Purpose and entities | Visible controls | Actual behavior and persistence | Mock vs real | States and mobile | Coverage | Status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `/` Home | Dashboard over `sources`, `claims`, `relationships`, `actions`; quick import. | Open Atlas, Quick Import textarea/button, recent source links. | Counts and recent sources query `getRepos()`. Quick Import posts `/api/sources` but does not call `/api/sources/[id]/process`; it redirects to Inbox. Evidence: `src/app/home-quick-import.tsx:27-34`. | No AI call directly. | Empty recent-source state exists. Responsive grid. | Not directly e2e-tested. | `partially_working` due stranded quick import. |
| `/inbox` | Import, processing, ready-for-review queue for `sources`, `transcripts`, `claims`. | Text import, media upload, Retry failed, Review claims. | Text/media imports call `/api/sources`, then `/process`. Polls active statuses. Ready list includes `ready_for_review`. Evidence: `src/app/inbox/inbox-client.tsx:91-147`, `:165-170`, `:314-344`. | Mock or real providers selected by env during `/process`. | Processing, failed, ready, empty states exist. Mobile stacks. | `e2e/inbox.spec.ts`, `e2e/transcription-upload.spec.ts`, `e2e/mvp-proof.spec.ts`. | `working` for direct Inbox import; `partially_working` for sources created elsewhere as `transcript_ready`. |
| `/inbox/review/[sourceId]` | Review transcript and extracted `claims`. | Save transcript, edit claim, pillar/item selects, Approve, Reject, Approve all, Send to Atlas, Open Atlas. | Persists transcript through `/api/transcripts/[id]`, claims through `/api/claims/[id]`, send through `/api/sources/[id]/send-to-atlas`. Evidence: `src/app/inbox/review/[sourceId]/review-client.tsx`. | Mock/real already happened before review. | Loader retries when server route lags. Empty claim state exists. Mobile stacks. | Inbox and MVP e2e cover edit/approve/send. | `working`. |
| `/atlas` | Visual graph of active claims, relationships, unsorted source cards, layout. | Search, verification/evidence filters, Organize, Undo, Redo, Reset layout, JSON/Markdown export, React Flow controls, mobile pillar accordions. | Loads active claims and relationships from repos. Organize updates claim statuses, layout, and relationship confirmations; layout persists. Evidence: `src/app/atlas/page.tsx`, `src/app/atlas/atlas-canvas.tsx`. | No AI. | Loading state, empty state, mobile accordion alternative. | `e2e/atlas.spec.ts`, `e2e/mvp-proof.spec.ts`, graph unit tests. | `partially_working` because `?claim=` and `?pillar=` deep links are emitted elsewhere but ignored by this route. |
| `/sources` | Browse imported sources. | Search, platform filter, status filter, card links. | Server fetches source cards; client filters locally. Evidence: `src/app/sources/page.tsx`, `src/app/sources/sources-client.tsx`. | No AI. | Empty filter state exists. Responsive cards. | Indirectly via source navigation in e2e. | `working`. |
| `/sources/[id]` | Source metadata, transcript, source-linked claims, reprocess/delete. | Reprocess dialog, Delete dialog, claim links to Atlas, Original URL. | Reads source/transcript/claims, `?t=` scrolls/highlights segment; reprocess posts `/process`, delete removes media and source. Evidence: `src/app/sources/[id]/source-detail-client.tsx`. | Reprocess uses provider selector if transcript missing; with retained transcript it re-extracts. | Loader retry, empty transcript/claim states, mobile stacking. | MVP and guide e2e cover timestamp navigation. | `working`, with `partially_working` note for external URL hygiene and duplicate reprocess accumulation. |
| `/verification` | Unverified/disputed claims plus duplicate review. | Scan for duplicates, Merge, Keep both, Dismiss, claim/source/Atlas links. | Duplicate scan writes unconfirmed duplicate relationships. Merge rejects lower-confidence claim and confirms relationship; keep both retypes as `related_to`; dismiss deletes relationship. Evidence: `src/app/verification/page.tsx`, `src/app/verification/duplicates-panel.tsx`, `src/app/api/duplicates/[id]/resolve/route.ts`. | Similarity mock or OpenAI embeddings by env. | Empty duplicate and empty status states. Mobile stacks. | `e2e/duplicates.spec.ts`, similarity tests. | `working` for duplicates; `future` for automatic contradiction suggestions. |
| `/guides` | Generate/read Atlas guide. | Generate guide, Regenerate stale, Regenerate all, Read guide. | Calls `/api/guides/generate`; guide card reflects version/status/stale count. Evidence: `src/app/guides/page.tsx`, `src/app/guides/generate-button.tsx`. | Mock or Anthropic guide provider by env. | Empty organized-claims state; future guide types disclosed. Responsive. | `e2e/guides.spec.ts`, guide unit tests. | `working`. |
| `/guides/atlas` | Guide reader with citation chips. | TOC links, citation chips, View in source, Open in Atlas, regenerate stale. | Renders constrained markdown as text; citation chips open popovers linking to source/Atlas. Evidence: `src/app/guides/atlas/section-body.tsx`. | No provider during read. | Not-found when no guide; stale section badges. Responsive grid. | `e2e/guides.spec.ts` covers generation, citation-to-source, stale regen. | `partially_working` because Open in Atlas uses ignored `?claim=` links. |
| `/actions` | Action list and creation. | New Action form, priority select, Add action, Move status, originating claim link. | Persists through `/api/actions` and `/api/actions/[id]`; cycles status client-side. Evidence: `src/app/actions/actions-client.tsx`. | No AI. | Empty state exists. Mobile stacks. | No direct e2e. | `working` but under-tested. |
| `/catalog` | Read-only taxonomy catalog grouped by pillar/topic. | Expand/collapse native details, source timestamp links. | Server queries claims/sources and groups by pillar/topic. Evidence: `src/app/catalog/page.tsx`. | No AI. | Native details and empty pillar states. | No direct e2e. | `working` but under-tested. |
| `/settings` | Provider status, data location, export, reset. | Export JSON, Export Markdown, Reset demo data dialog. | Provider modes from `describeAiCapabilities`; reset posts `/api/admin/reset`. Evidence: `src/app/settings/page.tsx`, `src/app/settings/settings-client.tsx`. | Shows mock/real status for extraction, guides, transcription, similarity. | Reset error toast; no loading skeleton needed. | Export covered by MVP e2e; reset used by e2e helper. | `working`. |

### API Routes

| Route | Purpose | Persistence and behavior | Coverage | Status |
| --- | --- | --- | --- | --- |
| `GET/POST /api/sources` | List source summaries; import JSON text/note or multipart media. | JSON path validates `ImportSourceSchema`. Multipart path validates `File`, writes temporary media, checksum-dedupes. Evidence: `src/app/api/sources/route.ts`. | Ingestion unit tests and e2e upload. | `working`. |
| `GET/DELETE /api/sources/[id]` | Read source detail payload; delete source. | Delete removes retained media then deletes source; FK cascades transcripts/claims/relationships. Evidence: `src/app/api/sources/[id]/route.ts`. | Indirect e2e; no delete negative test. | `working`, under-tested. |
| `POST /api/sources/[id]/process` | Transcribe if needed, extract claims, duplicate scan, mark ready. | Calls `processSource`; errors set source failed. Process is multi-step, not transaction-wrapped. | Ingestion unit tests and e2e. | `working`, with atomicity risk. |
| `POST /api/sources/[id]/send-to-atlas` | Flip approved or selected claims to unsorted. | Accepts optional `claimIds`; source -> complete. | Inbox/MVP e2e. | `working`. |
| `PATCH /api/claims/[id]` | Edit/restatus claim. | Validates review patch; marks guide stale for organized before/after. | Guide e2e uses API patch; no direct route unit tests. | `working`, under-tested. |
| `PATCH /api/claims` | Bulk status/pillar updates. | Validates all claims exist, then updates loop; marks guide stale. Not transaction-wrapped. | Atlas e2e via organize. | `working`, atomicity risk. |
| `PATCH /api/transcripts/[id]` | Edit transcript full text or segments. | Validates transcript patch; sets editedByUser. | Review UI e2e exercises transcript visibility but not transcript patch. | `working`, under-tested. |
| `PATCH /api/relationships` | Bulk confirm relationships. | Updates `userConfirmed` only. | Atlas organize path. | `working`, under-tested. |
| `GET/POST /api/actions`, `PATCH /api/actions/[id]` | List/create/update action items. | Validates action schemas and writes action rows. | Module/schema coverage only; no e2e. | `working`, under-tested. |
| `POST /api/duplicates/scan` | Run duplicate scan. | Provider-selected scan creates unconfirmed duplicate relationships. | Duplicate e2e and unit tests. | `working`. |
| `POST /api/duplicates/[id]/resolve` | Merge, keep both, dismiss, undo merge. | Multi-step relationship/claim mutations; no transaction. | Duplicate e2e and similarity tests. | `working`, atomicity risk. |
| `POST /api/guides/generate` | Generate full or stale guide sections. | Calls selected provider; repository upserts guide/sections. | Guide e2e and unit tests. | `working`. |
| `GET /api/export` | Download JSON or Markdown export. | Serializes sources/transcripts/claims/relationships/actions/pillars/guide. | Export unit snapshot and MVP e2e markdown. | `working`; import is absent/future. |
| `PUT/DELETE /api/layouts` | Save/reset layout. | Full positions map saved under default layout. | Atlas e2e indirectly. | `working`. |
| `GET /api/atlas` | Fresh Atlas payload. | Reads active claims and relationships. | Used by Atlas hydration and e2e duplicate assertion. | `working`. |
| `POST /api/admin/reset` | Reset local demo workspace. | Deletes all rows and reseeds. No auth boundary in local app. | Used by e2e helper. | `working` for local; unsafe for shared deployment. |

### Major Workflow Inventory

| Workflow | Actual behavior | Persistence | Mock vs real | Coverage | Status |
| --- | --- | --- | --- | --- | --- |
| Upload and transcription | Inbox multipart upload stores bytes, process route transcribes if no transcript, deletes media after transcript save. | `sources.media_path`, `transcripts`, `claims`; media file removed. | Mock transcriber unless `OPENAI_API_KEY` and not forced; real Whisper has 25 MB provider cap. | `e2e/transcription-upload.spec.ts`; ingestion tests. | `working`. |
| Pasted text import | Inbox text import creates transcript and starts extraction. | Source + transcript + pending claims. | Extraction mock or Anthropic. | `e2e/inbox.spec.ts`. | `working`. |
| Home quick import | Creates source only and redirects to Inbox. | Source + transcript with `processingStatus='transcript_ready'`; no claims unless manually processed elsewhere. | No AI starts. | No test. | `partially_working`. |
| Claim review | Review page edits claim, approves/rejects, saves transcript, sends approved to Atlas. | Claim/transcript/source updates. | No AI. | Inbox/MVP e2e. | `working`. |
| Organize flow | Dialog shows distribution, low confidence, relationship suggestions; confirm animates positions and persists status/layout/relationships. | Claim statuses, layout, relationships. | No AI. | Atlas/MVP e2e, graph tests. | `working`, atomicity risk. |
| Search | Atlas text search dims graph and shows clickable result panel; source list search filters locally; catalog is browsed by details. | No persistence. | No provider. | Atlas/MVP e2e covers Atlas search. | `working`. |
| Duplicate scan/resolution | Scan writes suggestions; Merge/Keep/Dismiss human-resolve them. | Relationships and claim status. | Mock Jaccard or OpenAI embeddings. | Duplicate e2e and unit tests. | `working`, atomicity risk. |
| Automatic contradiction suggestions | Extraction can emit possible contradictions within one extraction, and confirmed seed contradictions render in guide/Atlas. There is no first-class provider/candidate scan yet. | Existing `relationships` supports `contradicts`. | No M12 contradiction provider yet. | Guide e2e checks seeded contradiction callout. | `future`. |
| Guide generation | Organized claims group by pillar/topic; provider output citation-checked; sections upserted and stale tracked. | `guides`, `guide_sections`. | Mock or Anthropic. | Guide e2e and unit tests. | `working`. |
| Citation navigation | Guide citation chip opens popover and View in source link lands on `?t=` segment. | No persistence. | No provider. | Guide e2e. | `working` for source; `partially_working` for Open in Atlas deep link. |
| Reprocess flow | Source detail confirm posts `/process`; existing transcript means re-extract, not re-transcribe. | Adds more pending claims while keeping existing. | Extraction mock/real; transcription only if no transcript. | No direct e2e. | `partially_working`; duplication/expectation risk. |
| Export/import | JSON and Markdown export work. No import/re-import path exists. | Read-only export. | No provider. | Export snapshot and MVP e2e. | `partially_working`: export working, import future. |

## Control Audit

| Surface | Primary controls | Action performs? | Persists? | Safe failure and feedback? | Related views update? | Tested? | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| App shell | Sidebar/mobile navigation. | Yes. | No. | N/A. | Navigates. | Indirect e2e. | Working. |
| Home | Open Atlas, Quick Import. | Open Atlas yes; Quick Import creates source but does not process. | Quick Import persists source/transcript. | Toast on success/error. | Redirects Inbox but source may not appear in processing/ready lists. | No. | P1. |
| Inbox import | Import pasted text, Upload and transcribe, Retry failed, Review claims. | Yes. | Yes. | Toasts; failed card shows retry. | Refresh/poll updates. | Yes. | Working. |
| Review | Save transcript, Save edits, Approve, Reject, Approve all, Send to Atlas, Open Atlas. | Yes. | Yes. | Toasts; send disabled at 0 approved. | Local state + router refresh. | Yes. | Working. |
| Atlas toolbar | Search, filters, Organize, Undo, Redo, Reset, export links. | Yes. | Search/filter no; organize/layout/status yes; exports download. | Toasts and dialogs. | Canvas/store update. | Mostly yes. | Keyboard Cmd+Z/Shift+Cmd+Z is not implemented despite M4 handoff. |
| Atlas drawer | Save claim, Add to Actions, View in source, relationship jump, Reject. | Yes. | Claim/action/status persist. | Toasts and reject dialog. | Store updates; rejected claim removed from canvas. | MVP covers view in source; not add action/reject. | Working but partial coverage. |
| Source detail | Reprocess, Delete, claim links, external URL. | Yes. | Reprocess/delete persist. | Dialogs and toasts. | Router refresh/push. | Timestamp source path tested; delete/reprocess not. | External URL hygiene needs tightening. |
| Sources list | Search/filter selects, source card links. | Yes. | No. | Empty state. | Local filtering. | Indirect. | Working. |
| Verification | Scan duplicates, Merge, Keep both, Dismiss, Undo toast. | Yes. | Yes. | Toasts; scan catches errors. | Router refresh. | Duplicate e2e. | Mutation atomicity risk. |
| Guides | Generate, Regenerate stale/all, Read guide. | Yes. | Yes. | Toasts include failures. | Router refresh. | Guide e2e. | Working. |
| Guide reader | TOC anchors, citation chips, View in source, Open in Atlas, regenerate stale. | Mostly. | No for navigation; regen persists. | Citation popover. | Source navigation works. | Source citation tested. | Open in Atlas deep link is ignored. |
| Actions | Add action, status cycle, claim link. | Yes. | Yes. | Toast on create/error; no toast on status success. | Local state update. | No e2e. | Working, under-tested. |
| Settings | Export JSON/Markdown, Reset demo data. | Yes. | Reset persists; exports read. | Reset dialog and toast. | Router refresh. | Reset via e2e helper; export MVP. | Working for local single-user. |

No fake primary controls were found in the sense of buttons that do literally nothing. The main issue is controls whose destination or side effect is incomplete: Home Quick Import and Atlas deep links.

## Provider Audit

| Capability | Interface | Mock provider | Real provider | Selector/env | Failure behavior | Timeout/retry behavior | Cost/privacy | Coverage | Recommended next step |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Transcription | `TranscriptionProvider` in `src/modules/transcript/index.ts`. | `MockTranscriptionProvider`: deterministic segments from file name/size. | `OpenAiTranscriptionProvider`: OpenAI `whisper-1` verbose JSON segments. | `OPENAI_API_KEY` and not `ATLAS_FORCE_MOCK_AI=1`. | Typed `TranscriptionFailedError` for missing media, oversized Whisper file, bad key, rate limit. Process route sets source failed. | No explicit AbortController timeout. Manual Retry in Inbox. No automatic retry/backoff. | Real path sends uploaded media bytes to OpenAI; media deleted after transcript save. Cost per upload/minute. | Ingestion tests, transcription e2e. | Add explicit request timeout and document 100 MB app limit vs 25 MB Whisper limit in UI. |
| Extraction | `ExtractionProvider` in `src/modules/extraction/types.ts`. | `MockExtractionProvider`: seeded fixture + heuristic sentence extraction. | `AnthropicExtractionProvider`: Claude structured outputs. | `ANTHROPIC_API_KEY`, `ATLAS_EXTRACTION_MODEL`, mock force. | `ExtractionFailedError` for rate limit, connection, API, refusal, max tokens, schema mismatch. | No explicit client timeout; manual retry. | Sends transcript/source text to Anthropic in real mode. Cost per processed source. | Extraction tests, ingestion/e2e through mocks. | Add route-level negative tests and model timeout/cancellation policy. |
| Embeddings/similarity | `SimilarityProvider` in `src/modules/similarity/index.ts`. | `MockSimilarityProvider`: token-set Jaccard. | `OpenAiSimilarityProvider`: `text-embedding-3-small`, cached vectors. | `OPENAI_API_KEY` and not mock force. | OpenAI provider throws generic Error; scan route maps to 502 retriable. | No explicit timeout/backoff. Batch size 100. | Sends canonical claim text to OpenAI. Embeddings cached in SQLite. Cost per scanned/changed claim. | Similarity unit tests and duplicate e2e. | Improve error taxonomy and cache invalidation coverage for claim edits. |
| Guide generation | `GuideGenerationProvider` in `src/modules/guides/types.ts`. | `MockGuideProvider`: templated markdown with citations. | `AnthropicGuideProvider`: Claude structured output. | `ANTHROPIC_API_KEY`, model env, mock force. | `GuideGenerationFailedError`; orchestration keeps prior section body on failure and marks stale. | Route `maxDuration=300`; no client-visible progress beyond busy button. | Sends organized claims/source metadata to Anthropic. Cost per section. | Guide unit and e2e. | Add progress/job model before longer real guides. |
| Contradiction detection | Not implemented yet as first-class provider. | N/A except extraction fixture can emit possible contradictions inside a new batch. | N/A. | Future M12. | N/A. | N/A. | Would send claim pairs to Anthropic in M12. | Seed contradiction callout covered; no detection tests. | Implement M12 only after this audit is reviewed. |
| Search | Repository `claims.search`, Atlas graph search, Sources client filter. | Deterministic local search. | No provider. | N/A. | No remote failure. | Immediate client/server local. | Private/local. | Atlas search e2e; repository tests cover filters more than search UX. | Add deeper search tests and decide if Postgres full-text is needed in M13. |
| Visual processing | None. | N/A. | N/A. | N/A. | N/A. | N/A. | N/A. | N/A. | `future`; not a current product path. |

Settings discloses extraction, guides, transcription, and similarity mode through `describeAiCapabilities()` (`src/modules/ai-status.ts`).

## Data And Persistence Audit

### Schema And Repositories

- All app persistence routes through `getRepos()` and repository interfaces.
- SQLite uses portable TEXT ids, ISO strings, JSON TEXT fields.
- Foreign keys are enabled in `openDatabase()`.
- Source deletion cascades transcripts/claims/relationships through FK; actions set claim FK to null.
- Additive migration currently only ensures `sources.media_path`; new tables are created by `CREATE TABLE IF NOT EXISTS`.
- `claim_embeddings` exists as the pgvector seam.

### Transaction Boundaries

Good:

- `claims.createMany()` uses a better-sqlite3 transaction.
- Individual repository operations are parameterized, not string-concatenating user values except controlled placeholder lists.

Risks:

- `processSource()` updates source status, creates transcript, creates claims, creates relationships, runs duplicate scan, and sets source ready across multiple operations without one transaction. Provider calls should not be inside a DB transaction, but post-provider writes need a transaction boundary.
- Duplicate merge updates claim status and relationship row in multiple operations.
- Atlas organize persists layout, claim statuses, and relationship confirmations through multiple API requests from the client.
- Bulk claims PATCH validates all ids first, then updates in a loop without transaction.
- Guide generation upserts many sections and then updates guide status/version without a single repository transaction.

### Provenance And Deletion

- Source provenance is preserved on claims via `sourceId`, timestamps, and source metadata.
- Duplicate merge rejects the lower-confidence claim rather than deleting it. JSON export still includes rejected claims; Markdown export filters them out.
- `deleteSource()` deletes retained media before deleting the source; cascades remove linked claims and relationships. There is no undo for source deletion.
- Media retention works after transcription, but deletion is best-effort; orphan cleanup is manual.

### Export/Import Fidelity

- JSON export includes sources, transcripts, claims, relationships, actions, pillars, and guide sections.
- Markdown export includes active claims, actions, contradictions, and guide appendix with resolved citations.
- No import/re-import path exists. In the M11 inventory this is `partially_working`: export is real, import is future.

### Missing Constraints And Indexes

- Schema has indexes for transcript source, claim source/pillar/status, relationship ends, and guide sections by guide.
- There is no DB-level uniqueness constraint on unordered relationship pairs, so code prevents duplicate suggestions but SQLite does not.
- There are no DB-level CHECK constraints for enum columns. Route/module validation catches normal writes, but repositories can write invalid values in tests or future scripts.
- No index exists for `claims.updated_at`, `relationships.relationship_type`, or `relationships.user_confirmed`; current scale is fine, but verification/contradiction scans will benefit later.

## Test Audit

| Test area | Files | What is covered | Missing or weak coverage | Risk |
| --- | --- | --- | --- | --- |
| Repository/unit | `src/repositories/sqlite.test.ts` | CRUD, filters, cascades, seed sanity, layouts, embeddings round-trip. | No tests for transaction rollback around multi-step domain operations. | Medium. |
| Extraction | `src/modules/extraction/extraction.test.ts` | Schema sanitization, mock fixture, provider selector. | Anthropic live behavior only by manual script. | Low/medium. |
| Ingestion/media | `src/modules/ingestion/ingestion.test.ts` | Long text rejection, upload dedupe, non-media/empty rejection, retention delete. | No route-level multipart negative tests for oversized upload or bad MIME through `request.formData()`. | Medium. |
| Graph | `src/modules/graph/graph.test.ts` | Layout and graph build behavior. | Keyboard shortcut behavior not covered. | Low/medium. |
| Similarity | `src/modules/similarity/similarity.test.ts` | Jaccard, cosine, hash, mock duplicates, scan de-dupe, rejected filtering, embedding cache. | OpenAI error taxonomy and cache invalidation on claim edit not covered. | Medium. |
| Guides | `src/modules/guides/guides.test.ts` | Grouping, citation integrity, staleness, partial failure preservation. | Route-level guide failure and long-running progress not covered. | Medium. |
| Export | `src/modules/export/export.test.ts` | JSON/Markdown seed snapshots. | Export download headers and guide appendix edge cases are only partly covered. | Low. |
| E2E MVP | `e2e/mvp-proof.spec.ts` | Upload -> transcript -> review -> organize -> search -> drawer -> source timestamp -> export. | Reject-after-open and JSON export not covered. | Low. |
| E2E upload | `e2e/transcription-upload.spec.ts` | Multipart upload, mock transcript, duplicate bytes. | Unsupported/oversized file failure not covered. | Medium. |
| E2E duplicates | `e2e/duplicates.spec.ts` | Suggest duplicate, merge, scan/dismiss flow. | Keep both, undo merge, failed provider path not covered. | Medium. |
| E2E guides | `e2e/guides.spec.ts` | Generate, read, citation source trace, stale regen. | Open in Atlas from citation is not covered and currently incomplete. | Medium. |
| Actions/Catalog/Sources/Settings | Indirect e2e only. | Some navigation and export/reset indirectly. | No full e2e for action create/status, source delete/reprocess, source filters, catalog links. | Medium. |
| Route tests | Mostly absent. | API routes exercised through Playwright. | Direct negative tests for invalid bodies, 404s, provider failures, auth-less admin reset. | Medium. |

Flaky risks:

- Playwright `webServer` builds and starts production, which is stable but slower.
- Browser/canvas assertions depend on React Flow DOM classes and fit view behavior.
- Guide generation e2e is fast only because mock provider is deterministic.

## Security And Privacy Audit

### Secrets And Environment

- No committed `.env*` files found.
- Grep found fake test key strings such as `sk-test-not-real`, not real secrets.
- API keys are read from `process.env` server-side only. Settings discloses provider mode but not key values.

### Uploads And Media

- Multipart upload requires `audio/*` or `video/*`, rejects empty files, and enforces 100 MB app limit.
- Real Whisper provider separately rejects files over 25 MB.
- Media bytes are written under `ATLAS_MEDIA_DIR` or `data/media` and removed after transcription.
- `saveMediaFile()` uses `path.extname(fileName).slice(0, 10)` and `${sourceId}${ext}`; source id is generated server-side, limiting filename traversal risk.
- `ATLAS_MEDIA_DIR` is trusted configuration; do not let untrusted users set it.

### URLs And HTML/Markdown

- `sourceUrl` validation uses `z.string().url()`, which is not restricted to `http:`/`https:`. This should be tightened before beta.
- Review page renders original source with `target="_blank"` but no explicit `rel="noopener noreferrer"`.
- Guide markdown is rendered through constrained text parsing. No `dangerouslySetInnerHTML` was found.
- Source descriptions, claim text, and guide text render as React text nodes.

### Data Exposure And Deletion

- Local SQLite contains all transcripts/claims. README discloses local data path.
- Reset demo data is unauthenticated by design; acceptable only for local single-user/dev mode.
- Source delete cascades source-linked data but has no undo and no per-workspace isolation.
- Export JSON includes rejected claims and all source/transcript data. That is good for fidelity but should be disclosed as full-data export.

## Known Defects And Truth Gaps

1. Home Quick Import strands sources.
   - Evidence: `HomeQuickImport.submit()` only posts `/api/sources` then `router.push("/inbox")`; Inbox processing and ready filters exclude `transcript_ready`.
   - Status: `partially_working`.

2. Atlas deep links are emitted but ignored.
   - Evidence: source detail, actions, verification, catalog, and guide reader link to `/atlas?claim=...` or `/atlas?pillar=...`; `src/app/atlas/page.tsx` accepts no `searchParams`, and `AtlasClient` receives no initial selection/filter.
   - Status: `partially_working`.

3. Multi-step mutations can partially persist.
   - Evidence: `processSource()`, duplicate merge, bulk claim patch, guide generation, and Atlas organize span multiple writes/API calls.
   - Status: `working` at current scale, beta risk.

4. Automatic contradiction detection is not implemented.
   - Evidence: only extraction-provided `possibleContradictions` and seeded confirmed contradictions exist; no `src/modules/contradictions` provider.
   - Status: `future` and M12 scope.

5. Source URL scheme/blank target hardening is incomplete.
   - Evidence: `sourceUrl` schema accepts `.url()` without protocol narrowing; review external link opens a new tab without explicit `rel`.
   - Status: security hardening item.

6. Reprocess creates additional pending claims and has no de-duplication confirmation.
   - Evidence: source detail says existing claims are kept and `/process` creates new claims from the transcript.
   - Status: `partially_working`; behavior is honest but can surprise users.

7. Build emits an NFT tracing warning.
   - Evidence: Turbopack warning traces through `src/modules/ingestion/media.ts`.
   - Status: non-blocking build warning.

## Prioritized Backlog

### P0 - Broken, Unsafe, Or Blocks Core Workflow

No P0 issues found. The full gate passes and the core import -> review -> organize -> trace -> export workflow works under deterministic mocks.

### P1 - Required For Internal/Private Beta

#### P1.1 Fix Home Quick Import Processing

- Problem: Home Quick Import creates a `transcript_ready` source and redirects to Inbox without processing it.
- Evidence: `src/app/home-quick-import.tsx:27-34`; Inbox only displays processing statuses `queued/transcribing/extracting/failed` and ready status `ready_for_review` in `src/app/inbox/inbox-client.tsx:59-70`.
- User impact: User thinks quick import succeeded but cannot review claims; source may only appear on `/sources`.
- Proposed fix: After successful POST, call `/api/sources/[id]/process` as Inbox does, or make Inbox show `transcript_ready` with a Start processing control.
- Likely files/modules: `src/app/home-quick-import.tsx`, `src/app/inbox/inbox-client.tsx`, maybe `e2e/inbox.spec.ts`.
- Acceptance criteria: Quick import leads to an item in processing and then ready-for-review; no stranded `transcript_ready` source.
- Tests required: Playwright quick-import smoke; unit or route test for transcript_ready visibility if adding a start control.

#### P1.2 Honor Atlas Deep Links

- Problem: App emits `/atlas?claim=...` and `/atlas?pillar=...`, but Atlas ignores search params.
- Evidence: links in `src/app/sources/[id]/source-detail-client.tsx`, `src/app/actions/actions-client.tsx`, `src/app/verification/page.tsx`, `src/app/guides/atlas/section-body.tsx`; no `searchParams` in `src/app/atlas/page.tsx`.
- User impact: "Open in Atlas" does not open the referenced claim/pillar, breaking citation/source/action navigation.
- Proposed fix: Read `searchParams` in `/atlas`, pass `initialSelection`/`initialFilters` to `AtlasCanvas`, open drawer for `claim`, set pillar filter or focus for `pillar`.
- Likely files/modules: `src/app/atlas/page.tsx`, `src/app/atlas/atlas-client.tsx`, `src/app/atlas/atlas-canvas.tsx`, `src/stores/atlas-store.ts`.
- Acceptance criteria: Visiting `/atlas?claim=seed-claim-lor-timing` opens Claim Detail; `/atlas?pillar=mcat` filters or focuses MCAT.
- Tests required: Playwright from guide citation/action/source claim link to Atlas drawer.

#### P1.3 Add Transaction Boundaries For Multi-Write Domain Mutations

- Problem: Important mutations can partially persist when one write fails.
- Evidence: `processSource()` writes status/transcript/claims/relationships/scan without transaction after provider result; duplicate merge updates claim then relationship; Atlas organize persists across `/api/layouts`, `/api/claims`, `/api/relationships`.
- User impact: Internal beta users can see mismatched status, stale guide state, or partially merged duplicates after failures.
- Proposed fix: Add repository transaction helper or domain-level methods for post-provider writes, duplicate resolution, bulk claim+relationship updates, and guide section replacement.
- Likely files/modules: `src/repositories/types.ts`, `src/repositories/sqlite.ts`, `src/modules/ingestion/index.ts`, `src/app/api/duplicates/[id]/resolve/route.ts`, `src/app/api/claims/route.ts`, Atlas organize API design.
- Acceptance criteria: Simulated mid-mutation failure rolls back claim/relationship/source/guide changes.
- Tests required: Repository/domain tests with injected failure; route tests for duplicate merge rollback.

#### P1.4 Harden Source URL Handling

- Problem: Source URLs are accepted by generic URL validation and rendered as links; protocol is not narrowed to http/https, and one external new-tab link lacks explicit `rel`.
- Evidence: `src/modules/ingestion/index.ts` `sourceUrl: z.string().trim().url()...`; `src/app/inbox/review/[sourceId]/review-client.tsx` uses `target="_blank"`.
- User impact: Potential unsafe link behavior in imported source metadata.
- Proposed fix: Refine `sourceUrl` schema to `http:`/`https:` only; add `rel="noopener noreferrer"` to new-tab links; consider rendering external URLs with plain `<a>`.
- Likely files/modules: `src/modules/ingestion/index.ts`, review/source detail components, tests.
- Acceptance criteria: `javascript:` and other non-http schemes are rejected; external new-tab links include rel.
- Tests required: Import validation negative test; component or e2e smoke for original source link.

#### P1.5 Expand Route-Level Negative Tests

- Problem: Module and e2e coverage is strong, but API routes have limited direct negative coverage.
- Evidence: Existing tests are mostly module tests and 7 Playwright specs; no dedicated route tests for invalid JSON/multipart, 404s, unsupported formats, bad duplicate resolution payloads.
- User impact: Regression risk when tightening validation for beta.
- Proposed fix: Add route/integration tests using Next request handlers or lightweight server harness for APIs.
- Likely files/modules: `src/app/api/**/route.ts`, new `*.test.ts` files.
- Acceptance criteria: Invalid inputs produce expected status and JSON error for key routes.
- Tests required: `/api/sources`, `/api/claims`, `/api/duplicates/[id]/resolve`, `/api/export`, `/api/guides/generate`.

### P2 - Major UX Or Quality Improvement

#### P2.1 Add Explicit Provider Timeouts And Retry Policy

- Problem: Real OpenAI/Anthropic calls do not use explicit AbortController timeouts/backoff.
- Evidence: provider implementations call SDK/fetch directly.
- User impact: A hung provider can leave a source in processing longer than expected.
- Proposed fix: Add provider-level timeout helpers and consistent retriable error classes.
- Likely files/modules: `src/modules/transcript/openai-provider.ts`, `src/modules/similarity/openai-provider.ts`, `src/modules/extraction/anthropic-provider.ts`, `src/modules/guides/anthropic-provider.ts`.
- Acceptance criteria: Simulated timeout returns retriable error and UI can retry.
- Tests required: Provider tests with mocked fetch/SDK failure.

#### P2.2 Make Reprocess Safer And Clearer

- Problem: Reprocess creates new pending claims alongside existing claims; this is disclosed but can duplicate heavily.
- Evidence: source detail dialog says existing claims are kept; `processSource()` always creates new claims from extraction result.
- User impact: Users may accidentally create duplicates and clutter review.
- Proposed fix: Add choices: "Re-extract new claims", "Replace pending claims", "Cancel"; or auto-scan duplicates after reprocess and show summary.
- Likely files/modules: source detail client, process route, ingestion module.
- Acceptance criteria: Reprocess behavior is explicit and reversible or bounded.
- Tests required: Source reprocess e2e and duplicate-scan assertion.

#### P2.3 Resolve Turbopack NFT Warning

- Problem: Build succeeds but warns that dynamic filesystem tracing may include too much project state.
- Evidence: build output traces `next.config.ts -> src/modules/ingestion/media.ts -> src/app/api/sources/[id]/route.ts`.
- User impact: No immediate user impact, but deployment artifacts can be noisy or oversized.
- Proposed fix: Statically scope media path operations or add supported Turbopack ignore comments where appropriate.
- Likely files/modules: `src/modules/ingestion/media.ts`, `next.config.ts`.
- Acceptance criteria: `npm run build` completes without the NFT warning.
- Tests required: Build gate.

#### P2.4 Add Missing Keyboard Shortcuts Or Remove The Promise

- Problem: M4 specified Cmd+Z/Shift+Cmd+Z, but no keyboard handler exists.
- Evidence: no `keydown` handler in Atlas code.
- User impact: Power users expect undo/redo shortcuts on canvas.
- Proposed fix: Add guarded keydown handler that ignores inputs/textareas, or remove shortcut claims from docs if not desired.
- Likely files/modules: `src/app/atlas/atlas-canvas.tsx`.
- Acceptance criteria: Cmd+Z and Shift+Cmd+Z trigger undo/redo when focus is not in a text field.
- Tests required: Playwright keyboard test.

#### P2.5 Improve Mobile Atlas Search/Filter

- Problem: Mobile Atlas uses pillar accordions but does not expose search/filter controls.
- Evidence: `MobileAtlas` lists pillars/claims only; toolbar is desktop-only.
- User impact: Mobile users cannot efficiently find claims.
- Proposed fix: Add mobile search input and filters above accordion.
- Likely files/modules: `src/app/atlas/atlas-canvas.tsx`.
- Acceptance criteria: Mobile viewport can search and open a claim.
- Tests required: Mobile Playwright viewport test.

#### P2.6 Add Import/Restore Roadmap Or Feature Flag

- Problem: Export works, but import/re-import is absent while "Export/import" is a named audit surface.
- Evidence: `/api/export` exists; no import route or UI exists.
- User impact: Users cannot restore or migrate local workspace from exported data.
- Proposed fix: Decide whether import is Phase 3 beta requirement or later; if later, disclose export-only in Settings.
- Likely files/modules: settings page, README, future import route.
- Acceptance criteria: UI copy accurately says export-only, or import exists with validation.
- Tests required: Export/import tests if implemented.

### P3 - Creator Library And Scale Work

#### P3.1 Add Relationship Uniqueness And Richer Relationship Metadata

- Problem: Relationship pair uniqueness and M12 relationship semantics are not represented at DB level.
- Evidence: `relationships` has no unique pair constraint and limited fields.
- User impact: At scale, duplicate suggestions/contradiction suggestions can duplicate or lose rationale structure.
- Proposed fix: M12 should add suggestion metadata or a dedicated table with provider, confidence, classification, condition differences, and resolution.
- Likely files/modules: schema, repositories, contradiction module.
- Acceptance criteria: Duplicate relationship suggestions are impossible at DB level or resolved through a canonical suggestion key.
- Tests required: Repository duplicate prevention tests.

#### P3.2 Move Long-Running Work To Jobs

- Problem: transcription, extraction, embedding scan, and guide generation all run inside request/response flows.
- Evidence: route handlers call providers directly; guide route sets `maxDuration=300`.
- User impact: Creator-scale libraries or long media will need resumable background processing.
- Proposed fix: Evaluate jobs/queue in M13; defer integration until beta target requires it.
- Likely files/modules: process route, guide route, duplicate scan route.
- Acceptance criteria: Background jobs expose progress, retry, and failure recovery.
- Tests required: job integration tests and e2e progress tests.

#### P3.3 Search Infrastructure

- Problem: Search is local SQL/client filtering; no ranking, typo tolerance, or vector-assisted retrieval for larger libraries.
- Evidence: repository `claims.search()` uses LIKE; sources filter client-side.
- User impact: Larger creator libraries will become hard to navigate.
- Proposed fix: M13 should evaluate Postgres full-text plus pgvector as first integration step.
- Likely files/modules: repository adapters, search UI.
- Acceptance criteria: Ranked search across sources, claims, guides, and transcripts.
- Tests required: search ranking and regression fixtures.

### P4 - Experiments Or Optional Additions

#### P4.1 Visual/Media Processing

- Problem: No visual processing path exists for screenshots/video frames.
- Evidence: no visual provider/module.
- User impact: Not relevant to current transcript-first beta.
- Proposed fix: Defer until users need slide/screenshot extraction.
- Likely files/modules: future providers.
- Acceptance criteria: TBD.
- Tests required: TBD.

#### P4.2 Creator/Consensus/Collection Guides

- Problem: `/guides` intentionally says these are later phases.
- Evidence: Guides page "Coming later" card.
- User impact: Not needed for current Atlas guide validation.
- Proposed fix: Defer until guide reader and contradiction semantics stabilize.
- Likely files/modules: guide pipeline and routes.
- Acceptance criteria: TBD.
- Tests required: TBD.

## M11 Stop Point

M11 does not implement the backlog above. Recommended next decision: review P1 items before M12. In particular, decide whether to fix Atlas deep links and Home Quick Import before contradiction detection, because both affect the credibility of source-to-claim navigation during beta demos.
