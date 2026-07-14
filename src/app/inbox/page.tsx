import { PageHeader } from "@/components/shell/page-header";

export const metadata = { title: "Inbox" };

export default function InboxPage() {
  return (
    <div>
      <PageHeader title="Inbox" description="Review and process new imports." />
      <div className="px-6 py-8 md:px-10">
        <p className="text-sm text-muted-foreground">Coming together in a later milestone.</p>
      </div>
    </div>
  );
}
