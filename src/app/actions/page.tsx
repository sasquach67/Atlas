import { PageHeader } from "@/components/shell/page-header";

export const metadata = { title: "Actions" };

export default function ActionsPage() {
  return (
    <div>
      <PageHeader title="Actions" description="Advice converted into concrete next steps." />
      <div className="px-6 py-8 md:px-10">
        <p className="text-sm text-muted-foreground">Coming together in a later milestone.</p>
      </div>
    </div>
  );
}
