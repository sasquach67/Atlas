import Link from "next/link";
import { PageHeader } from "@/components/shell/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getRepos } from "@/db";
import { formatTimestamp, humanize } from "@/lib/format";

export const metadata = { title: "Verification" };
export const dynamic = "force-dynamic";

export default function VerificationPage() {
  const repos = getRepos();
  const claims = repos.claims
    .list()
    .filter(
      (claim) =>
        claim.status !== "rejected" &&
        (claim.verificationStatus === "unverified" ||
          claim.verificationStatus === "disputed"),
    );
  const sourcesById = new Map(repos.sources.list().map((source) => [source.id, source]));
  const groups = {
    disputed: claims.filter((claim) => claim.verificationStatus === "disputed"),
    unverified: claims.filter((claim) => claim.verificationStatus === "unverified"),
  };

  return (
    <div>
      <PageHeader title="Verification" description="Claims awaiting evidence and review." />
      <div className="grid gap-5 px-6 py-8 md:px-10">
        <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground">
          Verification here is an honest triage queue. Editorial workflows, official-source review,
          and consensus tracking are planned for Phase 5; for now, every item remains source-linked
          so you can inspect the underlying claim.
        </p>
        {Object.entries(groups).map(([status, items]) => (
          <Card key={status} className="rounded-lg">
            <CardHeader>
              <CardTitle>{humanize(status)}</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3">
              {items.length === 0 ? (
                <p className="text-sm text-muted-foreground">No {humanize(status).toLowerCase()} claims.</p>
              ) : (
                items.map((claim) => {
                  const source = claim.sourceId ? sourcesById.get(claim.sourceId) : null;
                  return (
                    <div key={claim.id} className="rounded-lg border p-3">
                      <div className="flex flex-wrap gap-1.5">
                        <Badge variant={status === "disputed" ? "destructive" : "outline"}>
                          {humanize(claim.verificationStatus)}
                        </Badge>
                        <Badge variant="outline">{humanize(claim.evidenceLevel)}</Badge>
                      </div>
                      <p className="mt-2 font-medium">{claim.canonicalText}</p>
                      <div className="mt-2 flex flex-wrap gap-3 text-sm">
                        <Link href={`/atlas?claim=${claim.id}`} className="text-primary underline underline-offset-4">
                          Open in Atlas
                        </Link>
                        {source ? (
                          <Link
                            href={`/sources/${source.id}${claim.timestampStart !== null ? `?t=${claim.timestampStart}` : ""}`}
                            className="text-primary underline underline-offset-4"
                          >
                            {source.title}
                            {claim.timestampStart !== null
                              ? ` @ ${formatTimestamp(claim.timestampStart)}`
                              : ""}
                          </Link>
                        ) : null}
                      </div>
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
