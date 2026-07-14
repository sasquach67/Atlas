import { PageHeader } from "@/components/shell/page-header";
import { getRepos } from "@/db";
import { ReviewClient } from "./review-client";
import { ReviewLoader } from "./review-loader";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ sourceId: string }>;
};

export default async function ReviewPage({ params }: Props) {
  const { sourceId } = await params;
  const repos = getRepos();
  const source = repos.sources.getById(sourceId);
  const transcript = repos.transcripts.getBySourceId(sourceId);
  if (!source || !transcript) {
    return (
      <div>
        <PageHeader title="Review Import" description="Loading extracted claims." />
        <ReviewLoader sourceId={sourceId} />
      </div>
    );
  }
  const claims = repos.claims.listBySourceId(sourceId);

  return (
    <div>
      <PageHeader
        title="Review Import"
        description={`${source.title} - ${claims.length} extracted claims`}
      />
      <ReviewClient source={source} transcript={transcript} initialClaims={claims} />
    </div>
  );
}
