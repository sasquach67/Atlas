import { PageHeader } from "@/components/shell/page-header";

export const metadata = { title: "Verification" };

export default function VerificationPage() {
  return (
    <div>
      <PageHeader title="Verification" description="Claims awaiting evidence and review." />
      <div className="px-6 py-8 md:px-10">
        <p className="text-sm text-muted-foreground">Coming together in a later milestone.</p>
      </div>
    </div>
  );
}
