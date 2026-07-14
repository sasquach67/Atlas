import Link from "next/link";
import { PageHeader } from "@/components/shell/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { getRepos } from "@/db";
import { formatTimestamp, humanize } from "@/lib/format";
import { PILLARS } from "@/modules/taxonomy";

export const metadata = { title: "Catalog" };
export const dynamic = "force-dynamic";

export default function CatalogPage() {
  const repos = getRepos();
  const claims = repos.claims.list().filter((claim) => claim.status !== "rejected");
  const sourcesById = new Map(repos.sources.list().map((source) => [source.id, source]));

  return (
    <div>
      <PageHeader title="Catalog" description="The pre-med journey as a structured outline." />
      <div className="grid gap-4 px-6 py-8 md:px-10">
        {PILLARS.map((pillar) => {
          const pillarClaims = claims.filter((claim) => claim.pillarId === pillar.id);
          const breakdown = pillarClaims.reduce<Record<string, number>>((acc, claim) => {
            acc[claim.verificationStatus] = (acc[claim.verificationStatus] ?? 0) + 1;
            return acc;
          }, {});
          const byTopic = pillarClaims.reduce<Record<string, typeof pillarClaims>>((acc, claim) => {
            const topic = claim.topic || "General";
            acc[topic] = acc[topic] ?? [];
            acc[topic].push(claim);
            return acc;
          }, {});
          return (
            <details key={pillar.id} className="rounded-lg border bg-card p-4">
              <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-3">
                <span className="flex items-center gap-2 font-display text-lg font-semibold">
                  <span className="size-3 rounded-full" style={{ backgroundColor: pillar.accent }} />
                  {pillar.name}
                </span>
                <span className="flex flex-wrap gap-1.5">
                  <Badge variant="secondary">{pillarClaims.length} claims</Badge>
                  {Object.entries(breakdown).map(([status, count]) => (
                    <Badge key={status} variant="outline">
                      {humanize(status)} {count}
                    </Badge>
                  ))}
                </span>
              </summary>
              <div className="mt-4 grid gap-4">
                {pillarClaims.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No claims yet.</p>
                ) : (
                  Object.entries(byTopic).map(([topic, topicClaims]) => (
                    <Card key={topic} className="rounded-lg">
                      <CardContent className="grid gap-3 p-4">
                        <h2 className="font-semibold">{topic}</h2>
                        {topicClaims.map((claim) => {
                          const source = claim.sourceId ? sourcesById.get(claim.sourceId) : null;
                          return (
                            <div key={claim.id} className="rounded-md border p-3">
                              <p className="font-medium">{claim.canonicalText}</p>
                              {source ? (
                                <Link
                                  href={`/sources/${source.id}${claim.timestampStart !== null ? `?t=${claim.timestampStart}` : ""}`}
                                  className="mt-1 block text-sm text-primary underline underline-offset-4"
                                >
                                  {source.title}
                                  {claim.timestampStart !== null
                                    ? ` @ ${formatTimestamp(claim.timestampStart)}`
                                    : ""}
                                </Link>
                              ) : null}
                            </div>
                          );
                        })}
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </details>
          );
        })}
      </div>
    </div>
  );
}
