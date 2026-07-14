import { PageHeader } from "@/components/shell/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { describeAiCapabilities } from "@/modules/ai-status";
import { SettingsActions } from "./settings-client";

export const metadata = { title: "Settings" };
export const dynamic = "force-dynamic";

export default function SettingsPage() {
  const capabilities = describeAiCapabilities();

  return (
    <div>
      <PageHeader title="Settings" description="Workspace, AI, and export preferences." />
      <div className="grid gap-5 px-6 py-8 md:px-10">
        <Card className="rounded-lg">
          <CardHeader>
            <CardTitle>AI Status</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3">
            {capabilities.map((cap) => (
              <div
                key={cap.capability}
                className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border/60 pb-3 last:border-b-0 last:pb-0"
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{cap.label}</span>
                  <Badge variant={cap.provider === "mock" ? "secondary" : "outline"}>
                    {cap.provider}
                  </Badge>
                </div>
                <p className="max-w-xl text-sm text-muted-foreground">{cap.detail}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="rounded-lg">
          <CardHeader>
            <CardTitle>Data</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <p className="text-sm text-muted-foreground">
              Local SQLite data lives at <span className="font-mono">data/atlas.db</span> unless
              <span className="font-mono"> ATLAS_DB_PATH</span> is set. Uploaded media is stored in
              <span className="font-mono"> data/media</span> only until its transcript is saved.
            </p>
            <SettingsActions />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
