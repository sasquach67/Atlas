import { PageHeader } from "@/components/shell/page-header";
import { getRepos } from "@/db";
import { ActionsClient } from "./actions-client";

export const metadata = { title: "Actions" };
export const dynamic = "force-dynamic";

export default function ActionsPage() {
  const repos = getRepos();
  return (
    <div>
      <PageHeader title="Actions" description="Advice converted into concrete next steps." />
      <ActionsClient initialActions={repos.actions.list()} claims={repos.claims.list()} />
    </div>
  );
}
