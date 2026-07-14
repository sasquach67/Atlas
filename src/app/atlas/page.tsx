import { PageHeader } from "@/components/shell/page-header";
import { getRepos } from "@/db";
import { AtlasClient } from "./atlas-client";

export const metadata = { title: "Atlas" };
export const dynamic = "force-dynamic";

export default function AtlasPage() {
  const repos = getRepos();
  const claims = repos.claims.list({ status: ["unsorted", "organized"] });
  const claimIds = new Set(claims.map((claim) => claim.id));
  const relationships = repos.relationships
    .list()
    .filter(
      (relationship) =>
        claimIds.has(relationship.fromClaimId) && claimIds.has(relationship.toClaimId),
    );
  const unsortedSourceIds = new Set(
    claims
      .filter((claim) => claim.status === "unsorted")
      .map((claim) => claim.sourceId)
      .filter((id): id is string => Boolean(id)),
  );
  const sources = repos.sources.list().filter((source) => unsortedSourceIds.has(source.id));

  return (
    <div>
      <PageHeader title="Atlas" description="The living map of everything you have captured." />
      <AtlasClient
        initialData={{
          claims,
          relationships,
          sources,
          layout: repos.layouts.getDefault(),
        }}
      />
    </div>
  );
}
