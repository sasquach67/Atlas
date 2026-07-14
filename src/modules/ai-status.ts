/**
 * One place that reports which AI path each capability is using, surfaced on
 * /settings and reused by UI copy. Selection logic must match the individual
 * provider factories: a capability goes "real" only when its key is present
 * and ATLAS_FORCE_MOCK_AI is not pinning mocks.
 */

export interface AiCapabilityStatus {
  capability: "extraction" | "transcription" | "similarity" | "guides";
  label: string;
  provider: "anthropic" | "openai" | "mock";
  detail: string;
}

function mocksForced(): boolean {
  return process.env.ATLAS_FORCE_MOCK_AI === "1";
}

export function describeAiCapabilities(): AiCapabilityStatus[] {
  const anthropicKey = Boolean(process.env.ANTHROPIC_API_KEY);
  const openaiKey = Boolean(process.env.OPENAI_API_KEY);
  const forced = mocksForced();
  const claudeModel = process.env.ATLAS_EXTRACTION_MODEL || "claude-opus-4-8";

  const anthropicDetail = (what: string) =>
    forced && anthropicKey
      ? "ATLAS_FORCE_MOCK_AI=1 — deterministic mock pinned on."
      : anthropicKey
        ? `${what} by ${claudeModel}.`
        : `No ANTHROPIC_API_KEY set — deterministic mock. Add a key to .env.local for real ${what.toLowerCase()}.`;

  const openaiDetail = (what: string, mockNote: string) =>
    forced && openaiKey
      ? "ATLAS_FORCE_MOCK_AI=1 — deterministic mock pinned on."
      : openaiKey
        ? what
        : `No OPENAI_API_KEY set — ${mockNote}`;

  return [
    {
      capability: "extraction",
      label: "Claim extraction",
      provider: anthropicKey && !forced ? "anthropic" : "mock",
      detail: anthropicDetail("Claims are extracted"),
    },
    {
      capability: "guides",
      label: "Guide synthesis",
      provider: anthropicKey && !forced ? "anthropic" : "mock",
      detail: anthropicDetail("Guide sections are synthesized"),
    },
    {
      capability: "transcription",
      label: "Transcription",
      provider: openaiKey && !forced ? "openai" : "mock",
      detail: openaiDetail(
        "Uploads are transcribed by OpenAI whisper-1 with segment timestamps.",
        "uploads get a deterministic demo transcript.",
      ),
    },
    {
      capability: "similarity",
      label: "Duplicate detection",
      provider: openaiKey && !forced ? "openai" : "mock",
      detail: openaiDetail(
        "Similarity uses OpenAI text-embedding-3-small with cached embeddings.",
        "similarity uses deterministic token overlap.",
      ),
    },
  ];
}
