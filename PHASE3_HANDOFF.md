# Codex Handoff — Premed Atlas Phase 3
## Product Truth Audit, Contradiction Intelligence, Build-vs-Integrate Sweep, and Internal Beta

Read, in order:

1. `AGENTS.md`
2. `CODEX_HANDOFF.md`
3. `PHASE2_HANDOFF.md`
4. This document

M0–M10 are complete. Preserve working architecture and conventions unless the audit finds a concrete defect.

---

# Phase 3 objective

Premed Atlas has moved beyond a static prototype. Phase 3 should determine what is genuinely production-capable, what is mocked or fragile, what should be replaced by mature services or libraries, and what should remain custom because it is part of the product’s differentiation.

This phase has four ordered milestones:

- **M11 — Product truth and functionality audit**
- **M12 — Automatic contradiction suggestions and manual resolution**
- **M13 — Build-vs-integrate and UX benchmark sweep**
- **M14 — Internal beta hardening and manual test script**

Do not begin by adding unrelated features. Complete the audit first, then implement contradiction intelligence, then produce the replacement/integration backlog, then prepare the application for manual internal beta.

---

# Non-negotiable product principles

1. Claims remain the fundamental knowledge unit.
2. Every meaningful claim remains traceable to its source and timestamp.
3. AI suggestions do not silently overwrite or merge user data.
4. Repetition does not prove truth.
5. Contradictions remain visible until a human resolves their relationship.
6. Evidence level and extraction confidence remain separate.
7. Creator-specific guidance and consensus guidance remain distinct.
8. Tests and CI use deterministic mocks and never require API keys.
9. All persistence continues through repository interfaces.
10. The app must clearly disclose whether each AI capability is using a mock or real provider.
11. Do not replace custom product logic with generic third-party tools when that logic is the core differentiator.
12. Do replace commodity infrastructure when a mature service materially improves reliability, security, or UX.

---

# M11 — Product truth and functionality audit

Before making major product changes, inspect the current repository and create:

```text
docs/PHASE3_PRODUCT_AUDIT.md
```

The audit must be evidence-based. Do not infer that a feature works because a page or button exists.

## M11.1 Route and workflow inventory

Inventory every route and major workflow.

For each route, record:

- Route
- Intended user purpose
- Primary entities used
- Visible controls
- Actual behavior
- Persistence behavior
- Mock versus real behavior
- Loading state
- Empty state
- Error state
- Mobile behavior
- Test coverage
- Known defects
- Completion status

Use these statuses:

```text
working
partially_working
mock_only
placeholder
broken
unclear
future
```

At minimum audit:

- Home
- Inbox
- Source detail
- Atlas canvas
- Verification
- Guides
- Guide reader
- Actions, if present
- Settings
- Export/import
- Search
- Upload and transcription
- Claim review
- Organize flow
- Duplicate scan and resolution
- Guide generation
- Citation navigation
- Reprocess flow

## M11.2 Control audit

Inventory all visible primary controls:

- buttons,
- menu items,
- tabs,
- filters,
- form submissions,
- dialogs,
- keyboard shortcuts,
- and context actions.

For each control answer:

- Does it perform an action?
- Does the action persist?
- Can it fail safely?
- Does it give feedback?
- Does it update related views?
- Is it tested?

No fake primary controls are allowed.

## M11.3 Provider audit

Document all current providers and selectors.

For each capability record:

- Interface
- Mock provider
- Real provider
- Environment variable
- Failure behavior
- Timeout behavior
- Retry behavior
- Cost considerations
- Privacy considerations
- Test coverage
- Recommended next step

Capabilities must include:

- transcription,
- extraction,
- embeddings/similarity,
- guide generation,
- contradiction detection after M12,
- and any search or visual-processing path.

## M11.4 Data and persistence audit

Inspect:

- schema,
- migrations,
- repository interfaces,
- SQLite adapter,
- transaction boundaries,
- foreign-key behavior,
- deletion effects,
- stale guide marking,
- duplicate merge reversibility,
- source provenance,
- and export/import fidelity.

Flag:

- orphan risks,
- duplicated state,
- derived values stored incorrectly,
- missing indexes,
- missing uniqueness constraints,
- and operations that are not atomic.

## M11.5 Test audit

Produce a table of:

- unit tests,
- route tests,
- integration tests,
- Playwright tests,
- untested critical paths,
- flaky risks,
- and missing negative tests.

Run the existing gate before changes and include the exact output:

```bash
npm run lint
npm run typecheck
npm test
npm run build
npm run test:e2e
```

## M11.6 Security and privacy audit

Check for:

- committed secrets,
- unsafe environment handling,
- unbounded uploads,
- MIME validation,
- path traversal,
- raw HTML rendering,
- unsafe markdown,
- source URL handling,
- personal data exposure,
- and missing deletion behavior.

Do not claim legal compliance. Document practical risks and engineering fixes.

## M11.7 Audit output

The audit must end with a prioritized backlog:

```text
P0 — broken, unsafe, or blocks core workflow
P1 — required for internal/private beta
P2 — major UX or quality improvement
P3 — creator-library and scale work
P4 — experiments or optional additions
```

Every item needs:

- problem,
- evidence,
- user impact,
- proposed fix,
- likely files/modules,
- acceptance criteria,
- and tests required.

Do not implement the entire audit backlog inside M11. Only fix issues that block the audit itself or make the gate fail.

Commit:

```text
M11: add product truth audit and prioritized backlog
```

---

# M12 — Automatic contradiction suggestions and manual resolution

The current system supports confirmed contradiction relationships and guide rendering, but automatic contradiction discovery must become a first-class workflow.

## M12.1 Provider interface

Create:

```text
src/modules/contradictions/
```

Define:

```ts
type ContradictionCandidate = {
  aId: string;
  bId: string;
  confidence: number;
  classification:
    | "contradicts"
    | "different_conditions"
    | "updates"
    | "narrows"
    | "expands"
    | "related_not_contradictory"
    | "unclear";
  rationale: string;
  conditionDifferences?: {
    audience?: string[];
    jurisdiction?: string[];
    applicationStage?: string[];
    school?: string[];
    date?: string[];
    assumptions?: string[];
  };
};

interface ContradictionProvider {
  analyzePairs(input: {
    claims: Claim[];
    sources: Source[];
    candidatePairs: Array<{ aId: string; bId: string }>;
  }): Promise<ContradictionCandidate[]>;
}
```

Implement:

- `MockContradictionProvider`
- `AnthropicContradictionProvider`

Provider selection follows existing conventions:

- real provider when `ANTHROPIC_API_KEY` exists and mock mode is not forced,
- deterministic mock otherwise,
- status exposed in Settings.

## M12.2 Candidate generation

Do not compare every claim against every claim with an expensive LLM call.

First create candidate pairs using:

- same or closely related pillar,
- same or related topic,
- embedding similarity or lexical overlap,
- overlapping entities or numerical subjects,
- compatible claim types,
- and active claim statuses.

Then send only plausible pairs to the contradiction provider.

Candidate generation must avoid:

- self-pairs,
- existing resolved relationships,
- rejected claims,
- duplicate-only pairs already awaiting duplicate review,
- and obviously unrelated topics.

## M12.3 Contradiction reasoning rules

The provider must distinguish genuine contradiction from contextual variation.

Before labeling `contradicts`, evaluate whether claims differ because of:

- audience,
- date,
- school,
- application cycle,
- state or country,
- financial assumptions,
- applicant stage,
- score range,
- evidence level,
- or recommendation scope.

Examples:

```text
"Take the MCAT after biochemistry"
versus
"You can take the MCAT before biochemistry"

Possible classification:
different_conditions
```

```text
"Every applicant needs 500 clinical hours"
versus
"There is no universal clinical-hour minimum"

Possible classification:
contradicts
```

```text
"Use resource X"
versus
"I stopped recommending resource X in 2026"

Possible classification:
updates
```

The provider must return structured output through Zod validation.

## M12.4 Persistence

Store unconfirmed suggestions in `relationships` or a dedicated suggestion table using the existing architectural style.

Required fields:

- relationship type or proposed type,
- `userConfirmed: false`,
- confidence,
- provider,
- rationale,
- condition differences,
- created date,
- and resolution status.

Do not mark claims themselves disputed merely because a suggestion exists.

## M12.5 When scans run

Run contradiction candidate analysis:

1. After new claims are extracted and stored
2. After claims are organized
3. When the user presses **Scan for contradictions**
4. Optionally after a claim is materially edited

Avoid creating duplicate suggestions.

## M12.6 Verification UI

Add a dedicated **Possible contradictions** section to `/verification`.

Each card shows both claims side by side:

- canonical text,
- original excerpt,
- claim type,
- evidence level,
- verification status,
- authority,
- freshness,
- source title,
- publication date,
- and source timestamp.

Display:

- provider confidence,
- AI rationale,
- and detected contextual differences.

Actions:

### Confirm contradiction

- Persist confirmed `contradicts` relationship
- Keep both claims active
- Mark relationship `userConfirmed: true`
- Make it available to Atlas and guide generation
- Mark affected guide sections stale

### Different conditions

- Persist `applies_under_different_conditions` or the closest existing portable relationship
- Preserve condition notes
- Do not treat as contradiction in guides
- Allow guide synthesis to explain the distinction when relevant

### Newer claim updates older claim

- Persist `updates`
- Preserve both claims
- Record temporal ordering
- Optionally mark older claim `outdated` only after explicit user confirmation
- Mark affected guide sections stale

### Related, not contradictory

- Persist `related_to`
- Mark suggestion resolved

### Dismiss

- Remove or resolve the suggestion
- Do not recreate it unless either claim changes materially

All actions must be reversible where practical.

## M12.7 Atlas and guide behavior

Confirmed contradictions should:

- appear as visibly distinct edges or conflict nodes in Atlas,
- be filterable,
- open both source-linked claims,
- and appear in guide synthesis as a `Sources disagree` callout.

Different-condition relationships should not be rendered as red conflict edges.

Guide generation must explain:

- what each source claims,
- evidence and authority differences,
- contextual assumptions,
- and unresolved uncertainty.

Never collapse competing claims into a fabricated universal answer.

## M12.8 Counts and navigation

Add:

- contradiction suggestion count in Verification navigation,
- unresolved confirmed contradiction count where useful,
- Atlas filter for conflicts,
- and direct navigation from guide callout to the relationship review/detail.

## M12.9 Tests

Unit tests:

- candidate filtering,
- mock provider determinism,
- Zod validation,
- contextual-difference classification,
- duplicate suggestion prevention,
- and provider selector.

Route/repository tests:

- create suggestion,
- confirm,
- different conditions,
- update relationship,
- related,
- dismiss,
- and guide staleness.

Playwright:

1. Import two claims designed to conflict.
2. Process and organize them.
3. Run or observe contradiction scan.
4. Open Verification.
5. Confirm contradiction.
6. Open Atlas and verify conflict display.
7. Generate or regenerate guide.
8. Verify `Sources disagree` callout.
9. Follow both citations to their sources.

Also test a pair that appears contradictory but is resolved as **Different conditions**.

Commit:

```text
M12: add contradiction detection and manual resolution
```

---

# M13 — Build-vs-integrate and UX benchmark sweep

Create:

```text
docs/BUILD_INTEGRATE_BENCHMARK_AUDIT.md
```

The purpose is to avoid weak homemade implementations of commodity infrastructure while protecting Premed Atlas’s differentiated product logic.

## M13.1 Classification framework

Classify every major capability as:

```text
BUILD
INTEGRATE
BENCHMARK
DEFER
REMOVE
```

### BUILD

Use for product differentiation:

- atomic claim model,
- source-to-claim provenance,
- pre-med taxonomy,
- contradiction resolution semantics,
- creator versus consensus guide logic,
- knowledge organization,
- verification model,
- and Premed-specific personalization.

### INTEGRATE

Consider mature services/libraries for:

- authentication,
- hosted database,
- object storage,
- background jobs,
- email,
- analytics,
- error monitoring,
- rate limiting,
- billing,
- document parsing,
- video/audio playback,
- markdown editing/rendering,
- upload progress,
- and search infrastructure.

### BENCHMARK

Study interaction patterns from mature products without copying proprietary code, branding, assets, or protected layouts.

Candidate categories:

- capture/import,
- inbox review,
- infinite canvas,
- knowledge graph,
- command palette,
- citation experience,
- upload progress,
- background processing,
- guide reading,
- and source playback.

### DEFER

Use where current scale does not justify replacement.

### REMOVE

Use for fake, redundant, or confusing features.

## M13.2 Required audit table

For each capability include:

- current implementation,
- current limitations,
- whether it is differentiating,
- candidate external options,
- API or library availability,
- migration effort,
- vendor lock-in,
- privacy impact,
- estimated cost class,
- recommendation,
- and priority.

## M13.3 Do not assume APIs exist

Verify through official documentation before recommending an integration.

Do not write statements such as:

> “Use Wispr’s API”

unless an official supported API exists and is suitable.

When an app has excellent UX but no usable API:

- benchmark its interaction,
- identify the underlying technical need,
- and choose a supported provider or library.

Example:

```text
Reference product:
Wispr Flow

Useful patterns:
fast capture, clear recording state, low-friction correction, latency masking

Implementation decision:
Benchmark interaction; use supported speech-to-text infrastructure rather than assuming a Wispr API.
```

## M13.4 Initial capabilities to evaluate

At minimum:

- Authentication: Supabase Auth, Clerk, Auth.js
- Hosted relational DB: Supabase/Postgres, Neon
- Object storage: Supabase Storage, Cloudflare R2, S3-compatible storage
- Background jobs: Trigger.dev, Inngest, Cloud Tasks or another appropriate queue
- Analytics: PostHog or privacy-conscious alternative
- Error monitoring: Sentry
- Product feedback: simple in-app feedback plus issue capture
- Uploads: direct-to-object-storage approach
- Markdown/editor: mature sanitized renderer/editor
- Search: PostgreSQL full-text plus pgvector initially
- Media playback: mature accessible player library if current player is weak
- Rate limiting: managed or framework-compatible implementation
- Email: Resend or equivalent if notifications become necessary

Do not install all of these in M13.

## M13.5 Output

End with an ordered integration roadmap:

```text
Now — blocks internal beta
Next — needed before private multi-user beta
Later — creator-library scale
Avoid — not justified or harmful
```

For each recommended integration, include a migration plan and rollback strategy.

Commit:

```text
M13: add build-vs-integrate and UX benchmark audit
```

---

# M14 — Internal beta hardening and manual test script

Use the M11 and M13 findings to implement only the highest-priority internal-beta fixes.

Do not attempt full multi-user production infrastructure unless the audit identifies it as necessary for the current deployment target.

## M14.1 Beta test mode

Add a clear internal testing affordance, such as:

- feedback button,
- copy debug context,
- visible provider mode,
- processing job details,
- and reset demo workspace.

Avoid exposing sensitive environment values.

## M14.2 Manual test document

Create:

```text
docs/INTERNAL_BETA_TEST_SCRIPT.md
```

The script should be usable by a non-developer.

Include:

### Setup

- Start application
- Check Settings provider statuses
- Confirm whether mock or real providers are active
- Create clean workspace or reset seed data

### Test A — Pasted text

- Import a clean advice paragraph
- Review transcript/text
- Review claims
- Edit one claim
- Reject one claim
- Organize remaining claims
- Verify source traceability

### Test B — Real media

- Upload a talking-head video
- Verify upload progress
- Verify processing state
- Review timestamps
- Trace claim to source
- Reprocess after media deletion

### Test C — Messy media

- Background noise
- Fast speech
- Medical acronyms
- Numerical advice
- Low-confidence transcript
- Verify user correction flow

### Test D — Duplicate handling

- Import semantically repeated advice
- Run duplicate scan
- Merge one pair
- Keep one pair distinct
- Dismiss one pair
- Verify provenance and undo

### Test E — Contradictions

- Import two genuinely conflicting claims
- Confirm contradiction
- Verify Atlas edge/conflict node
- Verify guide callout
- Import context-dependent claims
- Resolve as different conditions

### Test F — Guide

- Generate guide
- Inspect citations
- Follow citation to source timestamp
- Edit claim
- Verify section stale
- Regenerate stale sections

### Test G — Search and export

- Search by keyword
- Search by pillar or tag
- Export JSON
- Export Markdown
- Re-import where supported
- Verify no source links are lost

### Test H — Failure states

- Unsupported file
- Oversized file
- Duplicate file
- Bad API key
- Provider rate limit or simulated failure
- Retry
- Refresh during processing
- Confirm recovery

### Test I — Mobile/tablet

- Import
- Review
- Search
- Read guide
- Inspect source
- Confirm no unusable desktop-only controls block core tasks

For every step provide:

```text
Expected result
Actual result
Pass / Fail
Notes
Screenshot reference
Severity
```

## M14.3 Issue template

Create a beta issue template containing:

- page,
- action attempted,
- expected result,
- actual result,
- reproduction steps,
- provider mode,
- browser/device,
- screenshot,
- severity,
- and whether data was lost.

## M14.4 Final gate

Run:

```bash
npm run lint
npm run typecheck
npm test
npm run build
npm run test:e2e
```

Update README with:

- Phase 3 capabilities,
- contradiction provider,
- audit document links,
- and internal beta instructions.

Commit:

```text
M14: harden internal beta and add manual test script
```

---

# Completion definition

Phase 3 is complete when:

1. The repository has an evidence-based truth audit.
2. Every major screen and workflow is classified accurately.
3. Automatic contradiction suggestions exist.
4. Contradictions require human resolution.
5. Contextual differences are distinguished from true contradictions.
6. Confirmed contradictions appear in Atlas and guides.
7. Commodity infrastructure has a documented build-vs-integrate decision.
8. No unsupported third-party API is assumed.
9. A non-developer internal beta script exists.
10. The complete gate passes.

---

# What not to do

- Do not add creator-library crawling in this phase.
- Do not migrate the whole database before the audit.
- Do not add authentication merely because it is conventional if the current local testing phase does not require it.
- Do not replace React Flow, SQLite, or existing providers without documented evidence.
- Do not auto-resolve contradictions.
- Do not mark a claim false simply because another claim conflicts with it.
- Do not treat high model confidence as high evidence quality.
- Do not expose API keys in the UI, logs, or repository.
- Do not imitate another product’s branding or proprietary implementation.
- Do not leave visible controls nonfunctional.

---

# Final instruction to Codex

Work milestone by milestone. Begin with M11 and stop after completing the audit, committing it, and reporting the prioritized backlog. Do not proceed to M12 until the audit is complete and the existing gate passes.

At each milestone:

1. State the plan.
2. Inspect existing relevant code.
3. Implement or document only the milestone scope.
4. Add tests.
5. Run the milestone gate.
6. Commit with the required prefix.
7. Report files changed, behavior added, known limitations, and exact test output.
