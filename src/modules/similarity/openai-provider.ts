import type { ClaimTextRef, SimilarPair, SimilarityProvider } from "./index";

/**
 * Embedding-based similarity via OpenAI text-embedding-3-small (plain fetch,
 * no SDK). Vectors are cached through EmbeddingCache so re-scans only embed
 * new or edited claims.
 */

const OPENAI_EMBEDDINGS_URL = "https://api.openai.com/v1/embeddings";
const MODEL = "text-embedding-3-small";

export interface CachedEmbedding {
  claimId: string;
  model: string;
  vector: number[];
  /** Hash of the text the vector was computed from, to invalidate on edit. */
  textHash: string;
}

export interface EmbeddingCache {
  getMany(claimIds: string[]): CachedEmbedding[];
  upsert(embedding: CachedEmbedding): void;
}

export function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  const length = Math.min(a.length, b.length);
  for (let i = 0; i < length; i++) {
    dot += a[i]! * b[i]!;
    normA += a[i]! * a[i]!;
    normB += b[i]! * b[i]!;
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

export function textHash(text: string): string {
  let hash = 5381;
  for (let i = 0; i < text.length; i++) {
    hash = ((hash << 5) + hash + text.charCodeAt(i)) >>> 0;
  }
  return hash.toString(16);
}

export class OpenAiSimilarityProvider implements SimilarityProvider {
  readonly name = `openai:${MODEL}`;
  readonly defaultThreshold = 0.86;

  constructor(
    private apiKey: string,
    private cache?: EmbeddingCache,
  ) {}

  private async embed(texts: string[]): Promise<number[][]> {
    const response = await fetch(OPENAI_EMBEDDINGS_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ model: MODEL, input: texts }),
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      throw new Error(`Embedding request failed (${response.status}): ${detail.slice(0, 200)}`);
    }
    const data = (await response.json()) as { data: { index: number; embedding: number[] }[] };
    const vectors = new Array<number[]>(texts.length);
    for (const item of data.data) vectors[item.index] = item.embedding;
    return vectors;
  }

  async similarPairs(claims: ClaimTextRef[], threshold = this.defaultThreshold): Promise<SimilarPair[]> {
    const cached = new Map(
      (this.cache?.getMany(claims.map((c) => c.id)) ?? []).map((e) => [e.claimId, e]),
    );
    const vectors = new Map<string, number[]>();
    const missing: ClaimTextRef[] = [];
    for (const claim of claims) {
      const hit = cached.get(claim.id);
      if (hit && hit.model === MODEL && hit.textHash === textHash(claim.text)) {
        vectors.set(claim.id, hit.vector);
      } else {
        missing.push(claim);
      }
    }

    // Embed in batches of 100 inputs.
    for (let i = 0; i < missing.length; i += 100) {
      const batch = missing.slice(i, i + 100);
      const embedded = await this.embed(batch.map((c) => c.text));
      batch.forEach((claim, index) => {
        const vector = embedded[index];
        if (!vector) return;
        vectors.set(claim.id, vector);
        this.cache?.upsert({
          claimId: claim.id,
          model: MODEL,
          vector,
          textHash: textHash(claim.text),
        });
      });
    }

    const pairs: SimilarPair[] = [];
    for (let i = 0; i < claims.length; i++) {
      for (let j = i + 1; j < claims.length; j++) {
        const a = vectors.get(claims[i]!.id);
        const b = vectors.get(claims[j]!.id);
        if (!a || !b) continue;
        const score = cosineSimilarity(a, b);
        if (score >= threshold) {
          pairs.push({ aId: claims[i]!.id, bId: claims[j]!.id, score: Number(score.toFixed(3)) });
        }
      }
    }
    return pairs.sort((a, b) => b.score - a.score);
  }
}
