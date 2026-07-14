import { getRepos } from "@/db";
import { SourceDetailLoader, SourceDetailView } from "./source-detail-client";

export const dynamic = "force-dynamic";

export default async function SourceDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ t?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const repos = getRepos();
  const source = repos.sources.getById(id);
  const targetSeconds = query.t ? Number(query.t) : null;
  const finiteTargetSeconds = Number.isFinite(targetSeconds) ? targetSeconds : null;
  if (!source) {
    return <SourceDetailLoader sourceId={id} targetSeconds={finiteTargetSeconds} />;
  }
  const transcript = repos.transcripts.getBySourceId(id);
  const claims = repos.claims.listBySourceId(id);

  return (
    <SourceDetailView
      source={source}
      transcript={transcript}
      claims={claims}
      targetSeconds={finiteTargetSeconds}
    />
  );
}
