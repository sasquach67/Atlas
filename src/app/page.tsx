import { PageHeader } from "@/components/shell/page-header";

export default function HomePage() {
  return (
    <div>
      <PageHeader
        title="Home"
        description="Your knowledge workspace at a glance."
      />
      <div className="px-6 py-8 md:px-10">
        <p className="text-sm text-muted-foreground">
          Coming together in a later milestone.
        </p>
      </div>
    </div>
  );
}
