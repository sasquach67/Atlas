<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Premed Atlas — project rules

- **Start here: read `CODEX_HANDOFF.md`** (conventions, structure, completion gate; M0–M6 are done) **then `PHASE2_HANDOFF.md`** (current work: M7–M10 — real transcription, duplicate detection, guide generation).
- All persistence goes through `getRepos()` from `@/db`; `modules/` and `repositories/` never import from `app/` or `components/`.
- Keep `npm run lint && npm run typecheck && npm test` green at every milestone boundary.
- Tests and e2e always use the mock AI providers (`ATLAS_FORCE_MOCK_AI=1`); never require an API key.
- Design: warm cream academic theme (tokens in `globals.css`); Lucide icons only; no gradients/neon/glassmorphism; no fake buttons — every visible control works.
