import { PageHeader } from "@/components/shell/page-header";

export const metadata = { title: "Atlas" };

export default function AtlasPage() {
  return (
    <div>
      <PageHeader title="Atlas" description="The living map of everything you have captured." />
      <div className="px-6 py-8 md:px-10">
        <p className="text-sm text-muted-foreground">Coming together in a later milestone.</p>
      </div>
    </div>
  );
}
