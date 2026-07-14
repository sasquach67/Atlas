import Link from "next/link";
import { ArrowRight, BookOpen, Inbox, Map } from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { getRepos } from "@/db";
import { cn } from "@/lib/utils";
import { PILLARS } from "@/modules/taxonomy";
import { HomeQuickImport } from "./home-quick-import";

export const dynamic = "force-dynamic";

const QUOTES = [
  "Advice is evidence, not instruction.",
  "Specific claims beat vague vibes.",
  "Trace every confident claim back to its source.",
  "A good application system remembers what panic forgets.",
];

function dayOfYear(date = new Date()): number {
  const start = Date.UTC(date.getUTCFullYear(), 0, 0);
  const current = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  return Math.floor((current - start) / 86_400_000);
}

export default function HomePage() {
  const repos = getRepos();
  const sources = repos.sources.list();
  const claims = repos.claims.list();
  const relationships = repos.relationships.list();
  const actions = repos.actions.list();
  const counts = {
    claims: claims.filter((claim) => claim.status !== "rejected").length,
    unsorted: claims.filter((claim) => claim.status === "unsorted").length,
    unverified: claims.filter((claim) => claim.verificationStatus === "unverified").length,
    contradictions: relationships.filter(
      (relationship) => relationship.relationshipType === "contradicts",
    ).length,
    openActions: actions.filter((action) => action.status === "open").length,
  };
  const coverage = repos.claims.countByPillar();
  const quote = QUOTES[dayOfYear() % QUOTES.length];

  return (
    <div>
      <PageHeader
        title="Home"
        description="Your knowledge workspace at a glance."
      >
        <Link href="/atlas" className={cn(buttonVariants(), "gap-1.5")}>
          <Map className="size-4" strokeWidth={1.75} />
          Open Atlas
        </Link>
      </PageHeader>
      <div className="grid gap-6 px-6 py-8 md:px-10">
        <section className="grid gap-3 md:grid-cols-5">
          {[
            ["Claims", counts.claims],
            ["Unsorted", counts.unsorted],
            ["Unverified", counts.unverified],
            ["Contradictions", counts.contradictions],
            ["Open actions", counts.openActions],
          ].map(([label, value]) => (
            <Card key={label} className="rounded-lg">
              <CardHeader>
                <CardDescription>{label}</CardDescription>
                <CardTitle className="text-2xl">{value}</CardTitle>
              </CardHeader>
            </Card>
          ))}
        </section>

        <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
          <Card className="rounded-lg">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Inbox className="size-4 text-primary" strokeWidth={1.75} />
                <CardTitle>Quick Import</CardTitle>
              </div>
              <CardDescription>Send a pasted advice note to the Inbox for review.</CardDescription>
            </CardHeader>
            <CardContent>
              <HomeQuickImport />
            </CardContent>
          </Card>

          <Card className="rounded-lg">
            <CardHeader>
              <CardTitle>Daily Note</CardTitle>
              <CardDescription>{quote}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-10 gap-1.5" aria-label="Pillar coverage">
                {PILLARS.map((pillar) => (
                  <span
                    key={pillar.id}
                    title={pillar.name}
                    className="size-3 rounded-full border"
                    style={{
                      backgroundColor: coverage[pillar.id] ? pillar.accent : "transparent",
                      borderColor: pillar.accent,
                    }}
                  />
                ))}
              </div>
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-6 xl:grid-cols-2">
          <Card className="rounded-lg">
            <CardHeader>
              <div className="flex items-center gap-2">
                <BookOpen className="size-4 text-primary" strokeWidth={1.75} />
                <CardTitle>Recent Sources</CardTitle>
              </div>
              <CardDescription>Latest imported videos, posts, notes, and files.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3">
              {sources.slice(0, 5).map((source) => (
                <Link
                  key={source.id}
                  href={`/sources/${source.id}`}
                  className="flex items-center justify-between gap-4 rounded-lg border p-3 hover:bg-muted/40"
                >
                  <span>
                    <span className="block font-medium">{source.title}</span>
                    <span className="text-sm text-muted-foreground">
                      {source.platform ?? source.type}
                    </span>
                  </span>
                  <ArrowRight className="size-4 text-muted-foreground" strokeWidth={1.75} />
                </Link>
              ))}
              {sources.length === 0 ? (
                <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                  No sources yet. Start with a quick import.
                </p>
              ) : null}
            </CardContent>
          </Card>

          <Card className="rounded-lg">
            <CardHeader>
              <CardTitle>Review Focus</CardTitle>
              <CardDescription>Places where the map needs attention.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              <Badge variant="outline">{counts.unsorted} unsorted</Badge>
              <Badge variant="outline">{counts.unverified} unverified</Badge>
              <Badge variant="outline">{counts.contradictions} contradiction pairs</Badge>
              <Badge variant="outline">{counts.openActions} open actions</Badge>
            </CardContent>
          </Card>
        </section>
      </div>
    </div>
  );
}
