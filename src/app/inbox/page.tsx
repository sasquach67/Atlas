import { PageHeader } from "@/components/shell/page-header";
import { getRepos } from "@/db";
import { InboxClient } from "./inbox-client";

export const metadata = { title: "Inbox" };
export const dynamic = "force-dynamic";

export default function InboxPage() {
  const repos = getRepos();
  const sources = repos.sources.list().map((source) => {
    const claims = repos.claims.listBySourceId(source.id);
    return {
      ...source,
      claimCount: claims.length,
      approvedCount: claims.filter((claim) => claim.status === "approved").length,
      pendingReviewCount: claims.filter((claim) => claim.status === "pending_review").length,
    };
  });

  return (
    <div>
      <PageHeader title="Inbox" description="Review and process new imports." />
      <InboxClient initialSources={sources} />
    </div>
  );
}
