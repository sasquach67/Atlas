import type { Repositories } from "@/repositories/types";
import type { SimilarityProvider } from "./index";

/**
 * Compares active claims and records possible duplicates as unconfirmed
 * `duplicates` relationships for human review (spec 17.4: never auto-merge).
 *
 * `onlyInvolving` restricts suggestions to pairs that include at least one of
 * the given claim ids (used after processing a new source, so an import only
 * surfaces suggestions about its own claims).
 */
export async function scanForDuplicates(
  repos: Repositories,
  provider: SimilarityProvider,
  options?: { onlyInvolving?: string[] },
): Promise<{ suggested: number; scanned: number }> {
  const claims = repos.claims
    .list({ status: ["pending_review", "approved", "unsorted", "organized"] })
    .filter((claim) => claim.canonicalText.trim().length > 0);

  const pairs = await provider.similarPairs(
    claims.map((claim) => ({ id: claim.id, text: claim.canonicalText })),
  );

  const involving = options?.onlyInvolving ? new Set(options.onlyInvolving) : null;
  const existing = repos.relationships.list();
  const linked = new Set(
    existing.flatMap((rel) => [
      `${rel.fromClaimId}:${rel.toClaimId}`,
      `${rel.toClaimId}:${rel.fromClaimId}`,
    ]),
  );

  let suggested = 0;
  for (const pair of pairs) {
    if (involving && !involving.has(pair.aId) && !involving.has(pair.bId)) continue;
    if (linked.has(`${pair.aId}:${pair.bId}`)) continue;
    repos.relationships.create({
      id: crypto.randomUUID(),
      fromClaimId: pair.aId,
      toClaimId: pair.bId,
      relationshipType: "duplicates",
      note: `similarity ${pair.score} (${provider.name})`,
      userConfirmed: false,
    });
    linked.add(`${pair.aId}:${pair.bId}`);
    linked.add(`${pair.bId}:${pair.aId}`);
    suggested++;
  }
  return { suggested, scanned: claims.length };
}
