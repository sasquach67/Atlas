import { PageHeader } from "@/components/shell/page-header";

export const metadata = { title: "Sources" };

export default function SourcesPage() {
  return (
    <div>
      <PageHeader title="Sources" description="Every imported video, post, and note." />
      <div className="px-6 py-8 md:px-10">
        <p className="text-sm text-muted-foreground">Coming together in a later milestone.</p>
      </div>
    </div>
  );
}
