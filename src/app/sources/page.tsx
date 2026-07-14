import { PageHeader } from "@/components/shell/page-header";
import { getRepos } from "@/db";
import { SourcesClient } from "./sources-client";

export const metadata = { title: "Sources" };
export const dynamic = "force-dynamic";

export default function SourcesPage() {
  const repos = getRepos();
  const sources = repos.sources.list().map((source) => ({
    ...source,
    claimCount: repos.claims.listBySourceId(source.id).length,
  }));

  return (
    <div>
      <PageHeader title="Sources" description="Every imported video, post, and note." />
      <SourcesClient sources={sources} />
    </div>
  );
}
