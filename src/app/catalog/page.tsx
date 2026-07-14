import { PageHeader } from "@/components/shell/page-header";

export const metadata = { title: "Catalog" };

export default function CatalogPage() {
  return (
    <div>
      <PageHeader title="Catalog" description="The pre-med journey as a structured outline." />
      <div className="px-6 py-8 md:px-10">
        <p className="text-sm text-muted-foreground">Coming together in a later milestone.</p>
      </div>
    </div>
  );
}
