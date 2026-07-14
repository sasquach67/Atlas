import { PageHeader } from "@/components/shell/page-header";

export const metadata = { title: "Guides" };

export default function GuidesPage() {
  return (
    <div>
      <PageHeader title="Guides" description="Synthesized, source-linked knowledge documents." />
      <div className="px-6 py-8 md:px-10">
        <p className="text-sm text-muted-foreground">Coming together in a later milestone.</p>
      </div>
    </div>
  );
}
