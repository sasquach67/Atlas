import { OpenAiSimilarityProvider, type EmbeddingCache } from "./openai-provider";

/**
 * Similarity abstraction for duplicate detection (spec Section 17). The mock
 * uses deterministic token-set Jaccard overlap; the real provider uses OpenAI
 * embeddings with a persistent cache. This module is the pgvector seam: when
 * the data moves to Postgres, cached vectors move into a pgvector column and
 * cosine moves into SQL.
 */

export interface ClaimTextRef {
  id: string;
  text: string;
}

export interface SimilarPair {
  aId: string;
  bId: string;
  score: number;
}

export interface SimilarityProvider {
  readonly name: string;
  /** Default score threshold above which a pair counts as a possible duplicate. */
  readonly defaultThreshold: number;
  similarPairs(claims: ClaimTextRef[], threshold?: number): Promise<SimilarPair[]>;
}

const STOPWORDS = new Set([
  "a", "an", "the", "and", "or", "but", "to", "of", "in", "on", "for", "with",
  "is", "are", "was", "be", "been", "it", "its", "as", "at", "by", "that",
  "this", "these", "those", "you", "your", "not", "do", "does", "should",
]);

export function tokenSet(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((token) => token.length > 2 && !STOPWORDS.has(token)),
  );
}

export function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let intersection = 0;
  for (const token of a) if (b.has(token)) intersection++;
  return intersection / (a.size + b.size - intersection);
}

export class MockSimilarityProvider implements SimilarityProvider {
  readonly name = "mock-similarity-v1";
  readonly defaultThreshold = 0.55;

  async similarPairs(claims: ClaimTextRef[], threshold = this.defaultThreshold): Promise<SimilarPair[]> {
    const sets = claims.map((claim) => ({ id: claim.id, tokens: tokenSet(claim.text) }));
    const pairs: SimilarPair[] = [];
    for (let i = 0; i < sets.length; i++) {
      for (let j = i + 1; j < sets.length; j++) {
        const score = jaccard(sets[i]!.tokens, sets[j]!.tokens);
        if (score >= threshold) {
          pairs.push({ aId: sets[i]!.id, bId: sets[j]!.id, score: Number(score.toFixed(3)) });
        }
      }
    }
    return pairs.sort((a, b) => b.score - a.score);
  }
}

export function getSimilarityProvider(cache?: EmbeddingCache): SimilarityProvider {
  if (process.env.OPENAI_API_KEY && process.env.ATLAS_FORCE_MOCK_AI !== "1") {
    return new OpenAiSimilarityProvider(process.env.OPENAI_API_KEY, cache);
  }
  return new MockSimilarityProvider();
}

export {
  OpenAiSimilarityProvider,
  cosineSimilarity,
  textHash,
  type CachedEmbedding,
  type EmbeddingCache,
} from "./openai-provider";
export { scanForDuplicates } from "./scan";
