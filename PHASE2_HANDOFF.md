# Codex Handoff — Premed Atlas Phase 2 (Milestones M7–M10)

The MVP (M0–M6) is complete and gated: lint, typecheck, 32 unit tests, build, and 3 Playwright suites (including the E.44 proof) all pass at commit `bf03df7`. **Read `CODEX_HANDOFF.md` §1–§4 first** — product context, existing structure, and the hard conventions all still apply. This file only defines what Phase 2 adds.

Phase 2 = spec Section 37 "Atlas intelligence" plus real transcription:

- **M7 — Real media upload + transcription** (file bytes → Whisper → timestamped transcript, with retention)
- **M8 — Similarity + duplicate suggestions** (SimilarityProvider: mock + embeddings; human-controlled merge)
- **M9 — Guide generation** (hierarchical synthesis with per-sentence citations; `/guides` becomes real)
- **M10 — e2e coverage + gate + README update**

Provider rule (unchanged): every AI capability sits behind an interface with a deterministic mock; tests/CI never need keys. New env vars: `OPENAI_API_KEY` (Whisper + embeddings), plus existing `ANTHROPIC_API_KEY` (guide synthesis reuses the extraction pattern). `ATLAS_FORCE_MOCK_AI=1` pins ALL providers to mock.

## M7 — Real media upload + transcription

Today `POST /api/sources {kind:"file"}` stores metadata only and the mock invents a transcript. Make uploads real:

1. **Multipart upload.** Change the file path to `POST /api/sources` with `FormData` (`file` + optional `title`). In the route handler use `request.formData()`. Limits: 100 MB, MIME must start with `audio/` or `video/`. Save bytes to `data/media/{sourceId}{ext}` (`fs`, server-only — this dir is already inside gitignored `data/`). Checksum: SHA-256 of the bytes (`node:crypto`), replacing the name+size djb2 — keep the 409 duplicate behavior.
2. **`OpenAiTranscriptionProvider`** in `src/modules/transcript/openai-provider.ts`, implementing the existing `TranscriptionProvider` interface but accepting a file path (extend the interface: `transcribe(input: { name; size; type; path?: string })` — mock ignores `path`). Call OpenAI `POST /v1/audio/transcriptions` with `model=whisper-1`, `response_format=verbose_json`, `timestamp_granularities[]=segment` (plain `fetch` + `FormData` from `fs.openAsBlob` or a read stream — do NOT add the openai npm package for one endpoint). Map `segments[] {start,end,text}` → our `TranscriptSegment[]`. Errors → the existing failed-source + retry path with a readable message (bad key, 413 too large, 429).
3. **Selection**: `getTranscriptionProvider()` returns the OpenAI provider when `OPENAI_API_KEY` is set and `ATLAS_FORCE_MOCK_AI` isn't; mock otherwise. Extend `describeAiStatus()` to report transcription + embeddings + guides provider status; surface all of it on `/settings`.
4. **Retention (spec Section 31):** after transcription succeeds, delete the media file (default policy: "transcript kept long-term, media deleted after processing"). Add `mediaRetained: boolean` note on the source detail page. A `Reprocess` with deleted media falls back to re-extracting from the stored transcript (not re-transcribing) — say so in the UI.
5. Update the inbox import panel copy: uploads are transcribed for real when a key is present; otherwise the deterministic demo transcriber runs (read from the settings status endpoint — never hardcode which mode).

**Verify:** unit tests for the multipart route (mock provider), checksum dedupe, retention deletion; if `OPENAI_API_KEY` is present locally, a `scripts/try-transcribe.ts <file>` smoke. e2e continues to use the mock (`ATLAS_FORCE_MOCK_AI=1`), now exercising a real multipart upload with a small fixture file.

## M8 — Similarity + duplicate suggestions

1. **`SimilarityProvider`** interface in `src/modules/similarity/`: `embed(texts: string[]): Promise<number[][] | null>` and `similarPairs(claims: {id, text}[], threshold): Promise<{aId, bId, score}[]>`.
   - `MockSimilarityProvider`: token-set Jaccard over lowercased canonicalText (deterministic; threshold ~0.55).
   - `OpenAiSimilarityProvider`: `text-embedding-3-small` via fetch; cosine similarity in JS (fine at this scale); threshold ~0.86. Cache embeddings in a new `claim_embeddings` table (`claim_id TEXT PK, model TEXT, vector TEXT /* JSON array */, updated_at`) so re-runs only embed new/edited claims. This table is the pgvector seam — note it in the schema comment.
2. **When it runs:** (a) during `POST /api/sources/[id]/process`, after claims are stored, compare new claims against existing `unsorted|organized` claims and store suggestions; (b) a "Scan for duplicates" button on `/verification`. Suggestions are `relationships` rows `{relationshipType:'duplicates', userConfirmed:false, note:'similarity 0.91 (provider)'}`. Never auto-merge (spec 17.4/E.10).
3. **Review UI:** a "Possible duplicates" section on `/verification` (and count chip in the Atlas toolbar): each pair shows both claims side by side with source citations and three actions — **Merge** (keeps the higher-confidence claim; the other gets `status:'rejected'`, a `duplicates` relationship `userConfirmed:true` pointing survivor→rejected, and the survivor inherits the rejected claim's sourceId link via a new relationship — provenance must never be lost), **Keep both** (mark relationship `userConfirmed:true`, retype to `related_to`, note "similar but distinct"), **Dismiss** (delete the suggestion row). All three must be undo-safe server-side (merge is reversible by restoring the rejected claim's status — expose "Undo" in the success toast for 10s).
4. Organize modal: unconfirmed `duplicates` suggestions among the batch already show — make sure M8 suggestions appear there too (they will if stored as relationships; verify).

**Verify:** unit tests for Jaccard pairs, cosine math, threshold filtering, embedding cache reuse; merge/keep/dismiss route tests including provenance preservation; e2e: import a near-duplicate of a seeded claim → suggestion appears on /verification → Merge → canvas no longer shows the duplicate.

## M9 — Guide generation (the headline)

### Data
New tables (portable SQL, same style):
- `guides (id TEXT PK, type TEXT /* 'atlas' for now */, title TEXT, status TEXT /* 'draft'|'current'|'stale' */, version INTEGER, generated_at TEXT)`
- `guide_sections (id TEXT PK, guide_id TEXT FK, pillar_id TEXT, topic TEXT, sort_order INTEGER, body_markdown TEXT, supporting_claim_ids TEXT /* JSON */, unresolved_contradiction_ids TEXT /* JSON */, generated_at TEXT, stale INTEGER DEFAULT 0)`
Repositories: `GuideRepository` with the usual interface style.

### Provider
`GuideGenerationProvider` in `src/modules/guides/`: `synthesizeSection(input: { pillar, topic, claims: Claim[], contradictions: {a: Claim, b: Claim, note}[], sources: Source[] }): Promise<{ bodyMarkdown, supportingClaimIds }>`.
- **Anthropic impl**: reuse the M2 pattern exactly (`messages.parse` + `zodOutputFormat`, same model/env, `ExtractionFailedError` for failures). System prompt rules: synthesize ONLY from the provided claims; every paragraph ends with citation markers `[^claimId]` for the claims it draws on; never state a claim's content as settled fact when its verificationStatus is unverified/disputed — hedge and attribute ("one medical student reports…", "official AAMC guidance states…"); contradictions get an explicit "Sources disagree" callout paragraph explaining the conditions under which each side applies (spec 17.3); numerical thresholds keep their non-universal framing. Output schema: `{ bodyMarkdown: string, supportingClaimIds: string[] }`.
- **Mock impl** (deterministic): template — one intro sentence, then per claim a sentence built from canonicalText + evidence label + `[^claimId]`, plus a "Sources disagree" paragraph when contradictions exist. Must produce the same citation-marker format so the reader UI is fully testable without a key.

### Pipeline (`src/modules/guides/generate.ts`, pure orchestration over repos + provider)
`generateAtlasGuide(repos, provider)`:
1. claims = status `organized`, grouped by `pillarId` then `topic` (topic = section; skip empty).
2. For each section, collect confirmed `contradicts` relationships among its claims.
3. Call the provider per section (sequential is fine; ~15 sections at seed scale).
4. Upsert one guide (`type:'atlas'`, title "The Premed Atlas Guide"), replace its sections, bump `version`, set status `current`.
5. **Staleness:** when any claim is later edited/merged/rejected or new claims are organized, mark affected sections (matching pillar+topic) `stale=1` and the guide `stale` (hook this into the claim PATCH route and organize flow — a small `markGuideStale(repos, claim)` helper). Regeneration only rebuilds stale sections (spec Section 20 stage 6).

### Routes + UI
- `POST /api/guides/generate` (full or `{onlyStale:true}`), `GET /api/guides`, `GET /api/guides/[id]`.
- `/guides`: replace the placeholder — guide card with status/version/generated date, "Generate guide" (first run) / "Regenerate stale sections" button with progress state; keep one honest paragraph that creator/consensus guide types are Phase 4/5.
- `/guides/[id]`: reader — TOC sidebar (chapters = pillars, sections = topics), rendered markdown body, **citations rendered as superscript chips**: hovering/clicking `[^claimId]` shows the claim (canonicalText, verification badge, source title + `M:SS`) with links "View in source" (`/sources/[id]?t=`) and "Open in Atlas". Contradiction callouts styled distinctly (left border in `--destructive`-muted tone). Stale sections show a subtle "outdated — regenerate" banner. Every section footer: "N claims · M sources". Use a small markdown renderer — add `marked` (or render a constrained subset yourself); sanitize: the markdown comes from our own provider but escape raw HTML anyway.
- Export: add guides to the JSON export; Markdown export gains a `## Guide` appendix per section with citations resolved to `— Source Title @ M:SS`.

**Verify:** unit tests — grouping/orchestration with a stub provider, staleness marking on claim edit, citation-id integrity (every `[^id]` in bodyMarkdown exists in supportingClaimIds AND in the DB — reject provider output otherwise and mark section failed); mock-provider snapshot over seed data. e2e: generate guide → open reader → click a citation chip → "View in source" lands on the timestamped segment; edit the underlying claim → section shows stale → regenerate stale → banner clears.

## M10 — Gate + docs

- New/updated e2e specs: `e2e/transcription-upload.spec.ts` (multipart + mock), `e2e/duplicates.spec.ts`, `e2e/guides.spec.ts` (flows above). Keep them mock-driven and deterministic.
- README: new env vars (`OPENAI_API_KEY`), provider matrix table (capability × mock/real × env var), guide feature section, retention policy note.
- Update `describeAiStatus()`/settings as per M7.
- **Completion gate (must all pass, and is the last thing you run):** `npm run lint && npm run typecheck && npm test && npm run build && npm run test:e2e`.

## Traps carried forward + new ones

- Everything in `CODEX_HANDOFF.md` §9 still applies (React Flow nodeTypes identity, zundo pause/resume, base-ui shadcn props, server-only DB).
- `request.formData()` file handling: write with `Buffer.from(await file.arrayBuffer())` — fine at 100 MB, don't stream-optimize.
- Whisper `verbose_json` returns `segments[].start/end` as floats in seconds — matches our `TranscriptSegment` directly.
- Never send transcripts to OpenAI for embeddings/transcription when the user pinned mock mode — check `ATLAS_FORCE_MOCK_AI` in every selector.
- Guide markdown: claim ids contain hyphens/UUIDs — the `[^id]` marker regex must be `\[\^([\w-]+)\]`.
- Schema changes: `CREATE TABLE IF NOT EXISTS` keeps existing local DBs working — do NOT drop/rename existing columns; new tables only.
- Commit per milestone (`M7:` … `M10:`), keep the gates green at each boundary, and end your final summary with the full gate output.
