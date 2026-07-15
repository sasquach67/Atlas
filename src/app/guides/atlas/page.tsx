import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/shell/page-header";
import { Badge } from "@/components/ui/badge";
import { getRepos } from "@/db";
import { getPillar } from "@/modules/taxonomy";
import { GenerateGuideButton } from "../generate-button";
import { SectionBody, type CitationClaim } from "./section-body";

export const metadata = { title: "The Premed Atlas Guide" };
export const dynamic = "force-dynamic";

export default function AtlasGuidePage() {
  const repos = getRepos();
  const guide = repos.guides.getAtlasGuide();
  if (!guide) notFound();
  const sections = repos.guides.listSections(guide.id);
  if (sections.length === 0) notFound();

  const sourcesById = new Map(repos.sources.list().map((source) => [source.id, source]));
  const claimsForSection = (claimIds: string[]): CitationClaim[] =>
    claimIds.flatMap((id) => {
      const claim = repos.claims.getById(id);
      if (!claim) return [];
      return [
        {
          id: claim.id,
          canonicalText: claim.canonicalText,
          verificationStatus: claim.verificationStatus,
          evidenceLevel: claim.evidenceLevel,
          sourceId: claim.sourceId,
          sourceTitle: claim.sourceId
            ? (sourcesById.get(claim.sourceId)?.title ?? null)
            : null,
          timestampStart: claim.timestampStart,
        },
      ];
    });

  const chapters = new Map<string, typeof sections>();
  for (const section of sections) {
    const list = chapters.get(section.pillarId) ?? [];
    list.push(section);
    chapters.set(section.pillarId, list);
  }
  const staleCount = sections.filter((section) => section.stale).length;

  return (
    <div>
      <PageHeader
        title={guide.title}
        description={`Version ${guide.version} · synthesized only from your organized claims, with citations throughout.`}
      >
        {staleCount > 0 ? (
          <GenerateGuideButton mode="stale" label={`Regenerate ${staleCount} outdated`} />
        ) : null}
      </PageHeader>

      <div className="grid gap-8 px-6 py-8 md:px-10 lg:grid-cols-[220px_minmax(0,1fr)]">
        <nav aria-label="Guide contents" className="lg:sticky lg:top-8 lg:self-start">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Contents
          </p>
          <ol className="grid gap-1.5 text-sm">
            {Array.from(chapters.entries()).map(([pillarId, chapterSections]) => {
              const pillar = getPillar(pillarId);
              return (
                <li key={pillarId}>
                  <a
                    href={`#chapter-${pillarId}`}
                    className="flex items-center gap-2 text-muted-foreground hover:text-foreground"
                  >
                    <span
                      className="size-2 shrink-0 rounded-full"
                      style={{ backgroundColor: pillar.accent }}
                    />
                    {pillar.shortName}
                    <span className="text-xs">({chapterSections.length})</span>
                  </a>
                </li>
              );
            })}
          </ol>
        </nav>

        <article className="grid max-w-3xl gap-10">
          {Array.from(chapters.entries()).map(([pillarId, chapterSections]) => {
            const pillar = getPillar(pillarId);
            return (
              <section key={pillarId} id={`chapter-${pillarId}`} className="grid gap-6">
                <h2
                  className="border-b pb-2 font-display text-2xl font-semibold tracking-tight"
                  style={{ borderColor: pillar.accent }}
                >
                  {pillar.name}
                </h2>
                {chapterSections.map((section) => {
                  const citationClaims = claimsForSection(section.supportingClaimIds);
                  const sourceCount = new Set(
                    citationClaims.map((claim) => claim.sourceId).filter(Boolean),
                  ).size;
                  return (
                    <div key={section.id} className="grid gap-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-display text-lg font-semibold">{section.topic}</h3>
                        {section.stale ? (
                          <Badge variant="secondary">outdated — regenerate</Badge>
                        ) : null}
                      </div>
                      <SectionBody markdown={section.bodyMarkdown} claims={citationClaims} />
                      <p className="text-xs text-muted-foreground">
                        {section.supportingClaimIds.length} claim
                        {section.supportingClaimIds.length === 1 ? "" : "s"}
                        {sourceCount > 0
                          ? ` · ${sourceCount} source${sourceCount === 1 ? "" : "s"}`
                          : ""}{" "}
                        ·{" "}
                        <Link
                          href={`/atlas?pillar=${pillarId}`}
                          className="underline underline-offset-4 hover:text-foreground"
                        >
                          open in Atlas
                        </Link>
                      </p>
                    </div>
                  );
                })}
              </section>
            );
          })}
        </article>
      </div>
    </div>
  );
}
