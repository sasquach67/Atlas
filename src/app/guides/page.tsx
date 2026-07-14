import Link from "next/link";
import { PageHeader } from "@/components/shell/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata = { title: "Guides" };

export default function GuidesPage() {
  return (
    <div>
      <PageHeader title="Guides" description="Synthesized, source-linked knowledge documents." />
      <div className="px-6 py-8 md:px-10">
        <Card className="max-w-3xl rounded-lg">
          <CardHeader>
            <CardTitle>Planned - Phase 2</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 text-sm leading-relaxed text-muted-foreground">
            <p>
              Guides will turn creator notes, collections, consensus summaries, and personal
              study/application plans into source-linked documents. Today, the reliable read-only
              structure lives in the Catalog.
            </p>
            <Link href="/catalog" className="w-fit text-primary underline underline-offset-4">
              Open Catalog
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
