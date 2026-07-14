# Codex Handoff — Premed Atlas MVP, Milestones M3–M6

You are picking up a half-built Next.js app. **M0–M2 are complete, tested, and committed.** Your job is M3–M6: the ingestion UI, the Atlas canvas, the supporting views, and the end-to-end Playwright proof.

Read this file fully before writing code. The authoritative product spec is
`/Users/andyquach/Downloads/Premed_Atlas_Master_Product_Specification.md` (~4,900 lines) — you should not need it except to settle ambiguity; this handoff plus the code is designed to be sufficient. The approved implementation plan is mirrored below.

## 1. What this product is

Premed Atlas is "Recime for pre-med advice": users import advice content (video/audio/pasted text), AI extracts **atomic claims** with honest epistemic labels, the user reviews them, and approved claims live on an infinite visual canvas organized into 20 pre-med "pillars", always traceable back to the source timestamp.

**Definition of done (spec E.44)** — a user can:
1. upload a video/audio file → 2. receive a (mock) transcript → 3. review extracted claims → 4. organize claims → 5. see them in the Atlas → 6. search them → 7. open a claim → 8. trace it to a timestamped source → 9. edit or reject it → 10. export the knowledge as JSON/Markdown.

A pretty static prototype does NOT count. Every step must actually work, and a Playwright test must prove it.

## 2. What already exists (do not rebuild, do not restructure)

```
src/lib/types.ts                  Domain types + enum const arrays (single source of truth)
src/lib/schema/extraction.ts      Zod ExtractionResultSchema (AI output contract) + sanitizeExtractionResult
src/modules/taxonomy/index.ts     The 20 pillars: ids, names, icons (Lucide names), muted accent hexes,
                                  sortOrder, keyword hints. getPillar(), classifyByKeywords()
src/modules/transcript/index.ts   TranscriptionProvider iface, MockTranscriptionProvider (deterministic,
                                  1.5s delay, env ATLAS_MOCK_DELAY_MS), parseTranscriptText ([MM:SS] parser
                                  + plain-text proportional timestamps), MAX_TRANSCRIPT_CHARS=50000, djb2Hash
src/modules/extraction/           ExtractionProvider iface; AnthropicExtractionProvider (messages.parse +
                                  zodOutputFormat, model claude-opus-4-8, typed error handling via
                                  ExtractionFailedError{retriable}); MockExtractionProvider (deterministic:
                                  "500 clinical hours" fixture + heuristic fallback);
                                  getExtractionProvider() (env-based selection), describeAiStatus()
src/db/schema.ts                  Portable SQL schema (sources, transcripts, claims, relationships,
                                  action_items, saved_layouts)
src/db/index.ts                   getRepos() singleton — opens SQLite at ATLAS_DB_PATH || data/atlas.db,
                                  auto-seeds when empty (ATLAS_SKIP_SEED=1 disables), resetToSeedData()
src/db/seed.ts                    Section 41 seed content (see §3)
src/repositories/types.ts         Repository interfaces (the ONLY way anything touches the DB)
src/repositories/sqlite.ts        better-sqlite3 implementations incl. claims.search() and countByPillar()
src/components/shell/             AppShell (sidebar nav, mobile top bar), PageHeader
src/components/ui/                shadcn components (button, card, badge, dialog, sheet, input, textarea,
                                  select, tabs, tooltip, dropdown-menu, skeleton, separator, sonner,
                                  scroll-area, alert-dialog, label, switch)
src/app/                          layout.tsx (fonts + AppShell + Toaster), placeholder pages for all routes:
                                  /, /inbox, /atlas, /catalog, /guides, /sources, /sources/[id], /actions,
                                  /verification, /settings
scripts/seed.ts                   npm run seed / db:reset
scripts/try-extract.ts            live smoke for the Anthropic provider
vitest.config.ts                  vitest with @ alias; 23 tests currently green
```

**Verify your starting point:** `npm test` (23 pass), `npm run typecheck`, `npm run lint` — all clean at commit `9bb081e`.

## 3. Seed data you can rely on (stable IDs)

- `seed-src-clinical` — the "500 clinical hours" TikTok. Its 4 claims (`seed-claim-500hours`, `seed-claim-patient-contact`, `seed-claim-no-universal-min`, `seed-claim-journal`) have `status='unsorted'` → they populate the **Unsorted Imports** region so a demo starts one click from Organize. Its transcript has a segment at 42–58s.
- MCAT conflict pair: `seed-claim-mcat-long` vs `seed-claim-mcat-short` (both `disputed`), linked by relationship `seed-rel-mcat-conflict` (`contradicts`), plus conflict-concept claim `seed-claim-mcat-conflict` linked `related_to` both.
- `seed-claim-prereq-bio` — `officially_verified`, evidence `official`.
- `seed-claim-ps-reflection` (itemType `reflection`) linked to concept `seed-claim-ps-growth`.
- Research source `seed-src-research` with 2 claims; LOR claim `seed-claim-lor-timing` with open action `seed-action-lor`; finance resource `seed-claim-finance-wci`.
- All other seeded claims have `status='organized'`.

## 4. Hard conventions (violating these = rework)

1. **Next.js 16 breaking changes.** Read `node_modules/next/dist/docs/` when unsure — see AGENTS.md. Known: `params`/`searchParams` are **Promises** (must `await`); `next/dynamic` with `ssr: false` only works inside client components; pages that read the DB must `export const dynamic = "force-dynamic"` (they read SQLite directly, so static prerendering would bake stale data).
2. **Tailwind v4** (CSS-based config in `src/app/globals.css`, no tailwind.config). Theme tokens already defined: warm cream `--background`, etc. A `.dotted-grid` utility exists for the canvas background. `--font-display` (Newsreader serif) is applied to h1–h3 automatically; body is Karla; `--font-plex-mono` for timestamps via `font-mono`.
3. **shadcn here is the base-nova style on @base-ui/react** (not radix). Import from `@/components/ui/*` as usual; check the actual component source if an API surprises you.
4. **`modules/` and `repositories/` must never import from `app/` or `components/`.** Route handlers are thin: parse/validate with Zod → call repos/modules → return JSON.
5. **All persistence goes through `getRepos()`** from `@/db`. Never instantiate better-sqlite3 elsewhere. `better-sqlite3` is in `serverExternalPackages` — server-only; never import DB code into client components.
6. **IDs**: generate with `crypto.randomUUID()`. Timestamps: ISO-8601 strings.
7. **Design language** (spec section 26): warm cream academic workspace. No SaaS gradients, no neon, no glassmorphism, no emoji-as-icons (Lucide only, strokeWidth ~1.75). Muted pillar accents come from `PILLARS[n].accent`. Timestamps render in mono font as `M:SS`. Density without chaos; soft shadows; restrained radii (tokens already set).
8. **No fake UI.** Every visible button works. Empty/loading/error states are real. Destructive actions get an alert-dialog confirm. (Spec: "no fake primary buttons".)
9. **Tests use the mock providers.** Set `ATLAS_FORCE_MOCK_AI=1` and `ATLAS_MOCK_DELAY_MS=0` (unit) / small (e2e) and `ATLAS_DB_PATH` to a temp file for e2e. CI must never need an API key.
10. Keep `npm run lint`, `npm run typecheck`, `npm test` green at every milestone boundary. Commit per milestone with message prefix `M3:`, `M4:`, etc.

## 5. M3 — Ingestion pipeline + Inbox

### API routes (under `src/app/api/`)

- `POST /api/sources` — import. Body (Zod-validated, discriminated union):
  - `{ kind: "text", title?, text, creatorName?, platform?, sourceUrl? }` → source `type:'text'`, transcript from `parseTranscriptText(text)`, `processingStatus:'transcript_ready'`. Reject text > `MAX_TRANSCRIPT_CHARS` with 400 + friendly message.
  - `{ kind: "file", fileName, fileSize, fileType, title? }` → source `type:'video'|'audio'` by MIME, `processingStatus:'queued'`. (The file body itself is NOT stored — MVP stores metadata only; note this honestly in the UI as "audio is transcribed, media is not retained".) Compute `checksum = djb2Hash(fileName+fileSize).toString(16)` and return 409 with the existing source if `findByChecksum` hits (duplicate-import guard).
  - `{ kind: "note", title, text }` → source `type:'note'`, same as text.
- `POST /api/sources/[id]/process` — the pipeline, synchronous but status-stepped:
  1. if no transcript yet (file imports): set `transcribing`, await `getTranscriptionProvider().transcribe(...)`, store transcript;
  2. set `extracting`; call `getExtractionProvider().extract({source, transcript})`;
  3. map `ExtractionResult.claims` → `Claim` rows (`status:'pending_review'`, ids random, sourceId set); store extraction-suggested `possibleDuplicates/Contradictions` as relationships (`userConfirmed:false`) between the new claim ids;
  4. set source `ready_for_review`. On `ExtractionFailedError` set `failed` + `errorMessage`, return 502 with `{retriable}`.
- `GET /api/sources`, `GET/DELETE /api/sources/[id]` (delete cascades via FK; confirm dialog in UI shows affected claim count from `claims.listBySourceId`).
- `PATCH /api/claims/[id]` — review edits: canonicalText, pillarId, itemType, status (approve/reject), confidence untouched by user (display only). Validate enum fields against the const arrays from `@/lib/types`.
- `POST /api/sources/[id]/send-to-atlas` — flips all `approved` claims of the source to `unsorted`, source → `complete`.
- `PATCH /api/transcripts/[id]` — edited segments/fullText, sets `editedByUser: true`.

### Inbox UI (`/inbox`, client components + server page fetching via repos)

Three-tab or three-section layout: **Import**, **Processing**, **Ready for review**.
- Import panel: paste text/transcript (textarea + optional title/creator/platform), or file picker (accept audio/video; you only send metadata). On submit → POST → immediately POST `/process` (fire from client so status changes are observable) → toast.
- Processing list: sources with status `queued/transcribing/extracting`, polling every ~1.5s while any are pending; statuses rendered as labeled steps. Failed items show `errorMessage` + Retry button (re-POST `/process`) — this satisfies the spec's error-state requirement.
- Review screen (route `/inbox/review/[sourceId]` or a full-width panel): left = transcript segments (each shows `M:SS` mono timestamp; click segment could highlight), editable (textarea per segment or whole-text edit → PATCH transcript); right = claim cards, each with: canonicalText (inline editable), originalText quote, epistemic badge row (claimType, evidenceLevel, verificationStatus, confidence as e.g. "0.55 · low/med/high"), pillar select (20 options w/ accent dots), approve ✓ / reject ✗ toggles. Footer: "Approve all", then **"Send N approved claims to Atlas"** → send-to-atlas → toast → link to /atlas.

### Verify M3
Manual: paste a multi-sentence LOR-advice text → watch statuses → review → edit one claim, reject one, reassign one pillar → send to Atlas → claims are `unsorted` in DB. Add a Playwright smoke (`e2e/inbox.spec.ts`) for paste→review→approve→send. Unit-test the route logic where reasonable (e.g. import validation, dedupe 409).

## 6. M4 — Atlas canvas (the flagship; budget the most care here)

Deps already installed: `@xyflow/react` v12, `zustand` v5, `zundo` v2.

### Architecture
- `src/stores/atlas-store.ts` — Zustand store wrapped in zundo `temporal`. State: `claims: Claim[]`, `relationships`, `sources` (for source cards of unsorted claims), `positions: Record<nodeId,{x,y}>`, `search`, `filters` (pillarId?, claimType?, verificationStatus?, evidenceLevel?, minConfidence?), `selection`, `collapsedPillars: Set<string>`, plus actions. `partialize` history to `{positions, claims, relationships}` only. Load initial data from a `GET /api/atlas` route (claims status unsorted|organized + relationships + sources + saved layout).
- `src/modules/graph/layout.ts` — PURE functions, unit-tested: `pillarHubPositions()` (5×4 grid, ~900px cells, ordered by sortOrder), `claimPositionsAround(hub, claims)` (golden-angle spiral, radius grows with index), `unsortedRegionLayout(sources, claims)` (region pinned left of the grid at fixed rect; source card centered, claim chips in a column), `computeOrganizeTargets(claims, existingPositions)` → `Record<claimId, {x,y}>`.
- `src/modules/graph/build.ts` — PURE: `(claims, relationships, sources, positions, search, filters, collapsedPillars) → {nodes, edges}` for React Flow. Node types: `pillarHub` (always present, position from layout math, `draggable: false`), `claimCard` (one component, visual variant by `itemType`; conflict styling when itemType concept + tag "conflict" — or give `conflictNode` its own type keyed off the `contradicts` relationships), `sourceCard` (only for sources with unsorted claims), `unsortedRegion` (a `group` node behind them). Edges: membership claim→hub (faint, no arrow), `derived_from` claim→sourceCard (dotted), `contradicts` (destructive-color, animated), `related_to`/`duplicates`/`supports` (muted). Matching logic for search/filters returns a `dimmed: boolean` per node — non-matching nodes get className with `opacity-25 pointer-events-none`, matches get an accent ring; never remove data.
- `/atlas` page: server page is a thin wrapper; the canvas is a client component loaded with `next/dynamic` `ssr:false` from another client component. Import `@xyflow/react/dist/style.css`. Canvas config: `<Background>` (use dots to echo `.dotted-grid`), `<MiniMap>`, `<Controls>` (or custom toolbar: zoom in/out, fit, undo, redo, reset layout), `fitView`, multi-select + box select on by default, `onNodesChange` → write position deltas back to store (only for claim/source nodes).

### Organize flow (the demo's money shot)
Toolbar shows **"Organize N unsorted"** button when unsorted claims exist. Click → Dialog:
counts, proposed pillar distribution (horizontal bar per pillar using pillar accents), list of low-confidence claims (<0.6), extractor-suggested duplicates/contradictions (unconfirmed relationships between the unsorted claims) with accept/ignore checkboxes. Confirm →
1. compute targets via `computeOrganizeTargets`;
2. tween positions over ~700ms with a single `requestAnimationFrame` loop that writes interpolated positions into the store (ease-in-out). **Pause zundo during the tween** (`temporal.getState().pause()/resume()`) so the whole organize is ONE undo entry;
3. after tween: set those claims `status:'organized'`, create membership edges implicitly (derived from status), mark accepted contradiction relationships `userConfirmed:true`;
4. persist: `PATCH /api/claims` bulk status update (or per-claim), `PUT /api/layouts` positions, relationships confirm route. Toast "Organized N claims into M pillars".

### Detail drawer (Sheet, right side) — E.44 steps 7–9 live here
Opens on claim-node click: canonicalText (editable textarea + save), originalText blockquote, full badge set (itemType, claimType, scope chips, authorityType, evidenceLevel, verificationStatus, freshnessStatus, confidence), pillar select, suggested actions with "Add to Actions" buttons (POST /api/actions), Reject (with confirm; sets status rejected and removes node), and **"View in source"** → link `/sources/[id]?t={timestampStart}`. Also list relationships ("Contradicts: …" with jump-to-node).

### Undo/redo
Toolbar buttons + `⌘Z`/`⇧⌘Z` (guard: not when typing in an input/textarea). From zundo temporal store. Undoing an organize restores pre-organize positions AND statuses (they're in the same history entry — verify this works; if statuses live server-side, mirror the pre-organize snapshot into the store and re-persist on undo).

### Layout persistence
Debounced (1s) `PUT /api/layouts` with full positions map after drags/organize. "Reset layout" (confirm) → recompute from layout math, persist.

### Mobile (`< md`)
Do NOT render the canvas. Render pillar accordion list (pillar header with accent dot + counts → claims as cards) reusing the same detail drawer.

### Verify M4
- Vitest for `layout.ts` + `build.ts` (hub grid coords, spiral non-overlap at 30 claims scale, organize targets land within the owning pillar's cell, search dimming logic).
- Playwright `e2e/atlas.spec.ts`: seed DB → open /atlas → assert unsorted region shows 4 chips → Organize → assert `seed-claim-500hours` node's transform moved into the clinical-experience cell region → search "clinical hours" dims others → click node → drawer → "View in source" navigates to `/sources/seed-src-clinical?t=18`.

## 7. M5 — Supporting views + export

- `/` Home: real queries via repos (server component): recent sources (5), counts (claims, unsorted, unverified, contradiction pairs, open actions), pillar coverage mini-grid (20 dots colored by has-content), quick-import textarea that POSTs to /api/sources and redirects to /inbox, "Open Atlas" button, one static daily quote rotated by day-of-year from a small array.
- `/sources`: card grid; platform/status filter selects; search input (client filtering is fine at this scale); each card → detail.
- `/sources/[id]`: metadata header; transcript segments with mono timestamps; **`?t=` deep link scrolls to & highlights the matching segment** (client component: find segment where `startSeconds <= t < endSeconds`, `scrollIntoView`, accent background). Claims list for the source with status badges linking into /atlas (drawer open via query param `?claim=` is a nice-to-have). Reprocess button (re-POST /process; confirm if claims exist — it creates new pending_review claims). Delete button (alert-dialog stating affected claim count) → DELETE → redirect /sources.
- `/actions`: list with status toggle (open→in_progress→completed cycle or select), priority badge, due date, link to originating claim (drawer or source). "New action" inline form. PATCH/POST /api/actions.
- `/catalog`: server component; pillars in order, each expandable (`<details>` or client accordion): claim count, verification breakdown badges, claims grouped by `topic` with canonicalText + source title + timestamp link. Read-only.
- `/verification`: real list of claims with `verificationStatus in (unverified, disputed)` grouped by status, each linking to its source/atlas position; a short honest paragraph that editorial workflows are Phase 5.
- `/guides`: honest placeholder: explain creator/collection/consensus/personal guides (1 short paragraph), "Planned — Phase 2", link to /catalog. NO fake buttons.
- `/settings`: AI status card from `describeAiStatus()`; export buttons (below); "Reset demo data" (alert-dialog → POST /api/admin/reset → `resetToSeedData()`); data location note (`data/atlas.db`).
- Export: `GET /api/export?format=json|markdown` with `Content-Disposition: attachment; filename=premed-atlas-export.{json,md}`. Serializers as PURE functions in `src/modules/export/index.ts`:
  - JSON: `{exportedAt, version: 1, sources, transcripts, claims, relationships, actions, pillars}`.
  - Markdown: `# Premed Atlas Export`, then per pillar (sorted, only non-empty): `## {pillar.name}`, per claim: `### {canonicalText}`, blockquote originalText (if any), one line `type · scope · authority · evidence · verification · freshness · confidence`, citation line `— *{source.title}* ({platform}) @ {M:SS}` when sourced; final sections `## Actions`, `## Contradictions`.
  - Vitest snapshot tests over the seed data (create `:memory:` DB, seed, export, snapshot).
  - Buttons: /settings + Atlas toolbar (simple `<a href>` downloads).

## 8. M6 — E.44 proof + hardening + README

- `playwright.config.ts`: `webServer: { command: "ATLAS_DB_PATH=./data/e2e.db ATLAS_FORCE_MOCK_AI=1 ATLAS_MOCK_DELAY_MS=200 npm run dev", port: 3000, reuseExistingServer: false }` (or build+start for stability); delete the e2e DB in a global setup so each run starts from seed.
- `e2e/mvp-proof.spec.ts` — one serial spec walking all 10 E.44 steps (§1 above). File upload: use Playwright `setInputFiles` with a small generated `.mp3` fixture (bytes don't matter — only metadata is used). Assert: transcript visible with timestamps; claims reviewable; edit persists after reload; organize moves node (compare node transform before/after or assert it left the unsorted region's bounds); search dims; drawer→source `?t=` highlight; export downloads contain the edited text (use `page.waitForEvent('download')`).
- Hardening pass: keyboard focus visible on canvas nodes (tabIndex, Enter opens drawer); `aria-label`s on icon-only buttons; loading skeletons on async pages; empty states (e.g. fresh DB with ATLAS_SKIP_SEED) with a pointer to /inbox; alert-dialog on every destructive action; toasts on every mutation.
- README.md: what it is (2 paragraphs), quickstart (`npm i; npm run dev` — auto-seeds), env vars table (ANTHROPIC_API_KEY, ATLAS_EXTRACTION_MODEL, ATLAS_DB_PATH, ATLAS_FORCE_MOCK_AI, ATLAS_MOCK_DELAY_MS, ATLAS_SKIP_SEED), mock-vs-real AI explanation, architecture map (the §2 tree), decision log (standalone product; audio-first; claims as fundamental unit; manual review before merge; SQLite now/Supabase later via repository seam; KnowledgeItem folded into claims via itemType).
- **Completion gate — all must pass:** `npm run lint && npm run typecheck && npm test && npm run build && npm run test:e2e`.

## 9. Known traps

- React Flow v12 imports from `@xyflow/react`; node `type` strings must match the `nodeTypes` map defined OUTSIDE the component (or memoized) or you get infinite re-renders.
- zundo v2: `useStore(useAtlasStore.temporal, s => s)` for undo/redo state; `pause()/resume()` are on `useAtlasStore.temporal.getState()`.
- Next dev overlay intercepts some keyboard events — test ⌘Z in the page, not the overlay.
- `better-sqlite3` in route handlers only. If you see "Module not found: fs", you imported DB code client-side.
- The shadcn Sheet/Dialog here are base-ui-based; check `src/components/ui/sheet.tsx` for the actual prop names before use.
- Sonner toasts: import `{ toast }` from `sonner`.
- Playwright is installed but chromium may not be: run `npx playwright install chromium` once.
- Do not regenerate the lockfile or upgrade deps.

## 10. Working agreement

Work milestone by milestone (M3 → M4 → M5 → M6), keep the gates green, commit at each milestone boundary with prefix `M3:`/`M4:`/…, and end with the full completion gate output. If something in this handoff conflicts with reality in the repo, trust the repo and note the discrepancy in your final summary.
