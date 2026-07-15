import Link from "next/link";
import { ArrowRight, BookMarked } from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getRepos } from "@/db";
import { GenerateGuideButton } from "./generate-button";

export const metadata = { title: "Guides" };
export const dynamic = "force-dynamic";

export default function GuidesPage() {
  const repos = getRepos();
  const guide = repos.guides.getAtlasGuide();
  const sections = guide ? repos.guides.listSections(guide.id) : [];
  const staleCount = sections.filter((section) => section.stale).length;
  const organizedCount = repos.claims.list({ status: "organized" }).length;

  return (
    <div>
      <PageHeader title="Guides" description="Synthesized, source-linked knowledge documents." />
      <div className="grid gap-5 px-6 py-8 md:px-10">
        <Card className="max-w-3xl rounded-lg">
          <CardHeader>
            <div className="flex flex-wrap items-center gap-2">
              <BookMarked className="size-4 text-primary" strokeWidth={1.75} />
              <CardTitle>The Premed Atlas Guide</CardTitle>
              {guide ? (
                <Badge variant={guide.status === "current" ? "outline" : "secondary"}>
                  {guide.status === "current" ? `v${guide.version} · current` : `v${guide.version} · ${staleCount || "some"} section(s) outdated`}
                </Badge>
              ) : null}
            </div>
            <CardDescription>
              Every paragraph is synthesized only from your organized claims and cites them — trace
              any sentence back to the original source timestamp.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            {guide && sections.length > 0 ? (
              <>
                <p className="text-sm text-muted-foreground">
                  {sections.length} sections across{" "}
                  {new Set(sections.map((section) => section.pillarId)).size} chapters, generated{" "}
                  {guide.generatedAt ? new Date(guide.generatedAt).toLocaleString() : "—"}.
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <Link
                    href="/guides/atlas"
                    className="inline-flex items-center gap-1.5 text-primary underline underline-offset-4"
                  >
                    Read the guide <ArrowRight className="size-4" strokeWidth={1.75} />
                  </Link>
                  {staleCount > 0 ? (
                    <GenerateGuideButton mode="stale" label={`Regenerate ${staleCount} outdated`} />
                  ) : (
                    <GenerateGuideButton mode="full" label="Regenerate all" />
                  )}
                </div>
              </>
            ) : organizedCount > 0 ? (
              <>
                <p className="text-sm text-muted-foreground">
                  {organizedCount} organized claims are ready to be synthesized into a cited,
                  chaptered guide.
                </p>
                <div>
                  <GenerateGuideButton mode="full" label="Generate guide" />
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                No organized claims yet. Import advice in the Inbox and organize it in the Atlas
                first — the guide is synthesized from organized claims only.
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="max-w-3xl rounded-lg">
          <CardHeader>
            <CardTitle>Coming later</CardTitle>
          </CardHeader>
          <CardContent className="text-sm leading-relaxed text-muted-foreground">
            Creator guides (one creator&apos;s full library), collection guides, and consensus
            guides that weigh many creators against official sources are planned for Phases 4–5.
            The structured outline is always available in the{" "}
            <Link href="/catalog" className="text-primary underline underline-offset-4">
              Catalog
            </Link>
            .
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
