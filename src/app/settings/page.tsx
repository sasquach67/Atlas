import { PageHeader } from "@/components/shell/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { describeAiStatus } from "@/modules/extraction";
import { SettingsActions } from "./settings-client";

export const metadata = { title: "Settings" };
export const dynamic = "force-dynamic";

export default function SettingsPage() {
  const ai = describeAiStatus();

  return (
    <div>
      <PageHeader title="Settings" description="Workspace, AI, and export preferences." />
      <div className="grid gap-5 px-6 py-8 md:px-10">
        <Card className="rounded-lg">
          <CardHeader>
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle>AI Status</CardTitle>
              <Badge variant={ai.provider === "mock" ? "secondary" : "outline"}>
                {ai.provider}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">{ai.detail}</CardContent>
        </Card>

        <Card className="rounded-lg">
          <CardHeader>
            <CardTitle>Data</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <p className="text-sm text-muted-foreground">
              Local SQLite data lives at <span className="font-mono">data/atlas.db</span> unless
              <span className="font-mono"> ATLAS_DB_PATH</span> is set.
            </p>
            <SettingsActions />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
