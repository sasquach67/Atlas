import { PageHeader } from "@/components/shell/page-header";

export const metadata = { title: "Settings" };

export default function SettingsPage() {
  return (
    <div>
      <PageHeader title="Settings" description="Workspace, AI, and export preferences." />
      <div className="px-6 py-8 md:px-10">
        <p className="text-sm text-muted-foreground">Coming together in a later milestone.</p>
      </div>
    </div>
  );
}
