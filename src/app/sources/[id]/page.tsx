import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/shell/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getRepos } from "@/db";
import { formatTimestamp, humanize } from "@/lib/format";
import { SourceActions, TranscriptSegments } from "./source-detail-client";

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
  if (!source) notFound();
  const transcript = repos.transcripts.getBySourceId(id);
  const claims = repos.claims.listBySourceId(id);
  const targetSeconds = query.t ? Number(query.t) : null;

  return (
    <div>
      <PageHeader
        title={source.title}
        description={`${source.creatorName ?? "Unknown creator"} - ${source.platform ?? source.type}`}
      >
        <SourceActions sourceId={source.id} claimCount={claims.length} />
      </PageHeader>
      <div className="grid gap-6 px-6 py-8 md:px-10 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
        <section className="grid content-start gap-4">
          <Card className="rounded-lg">
            <CardHeader>
              <CardTitle>Metadata</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2 text-sm text-muted-foreground">
              <p>Status: {humanize(source.processingStatus)}</p>
              <p>Imported: {new Date(source.importedAt).toLocaleString()}</p>
              {source.sourceUrl ? (
                <Link href={source.sourceUrl} className="text-primary underline underline-offset-4">
                  Original URL
                </Link>
              ) : null}
              {source.description ? <p>{source.description}</p> : null}
            </CardContent>
          </Card>

          <Card className="rounded-lg">
            <CardHeader>
              <CardTitle>Transcript</CardTitle>
            </CardHeader>
            <CardContent>
              <TranscriptSegments
                segments={transcript?.segments ?? []}
                targetSeconds={Number.isFinite(targetSeconds) ? targetSeconds : null}
              />
            </CardContent>
          </Card>
        </section>

        <section className="grid content-start gap-3">
          <h2 className="font-display text-xl font-semibold">Claims</h2>
          {claims.length === 0 ? (
            <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
              No claims are linked to this source yet.
            </p>
          ) : (
            claims.map((claim) => (
              <Link
                key={claim.id}
                href={`/atlas?claim=${claim.id}`}
                className="rounded-lg border bg-card p-4 hover:bg-muted/30"
              >
                <div className="flex flex-wrap gap-1.5">
                  <Badge variant="outline">{humanize(claim.status)}</Badge>
                  <Badge variant="outline">{humanize(claim.verificationStatus)}</Badge>
                  {claim.timestampStart !== null ? (
                    <Badge variant="secondary" className="font-mono">
                      {formatTimestamp(claim.timestampStart)}
                    </Badge>
                  ) : null}
                </div>
                <p className="mt-2 font-medium">{claim.canonicalText}</p>
              </Link>
            ))
          )}
        </section>
      </div>
    </div>
  );
}
