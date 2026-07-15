"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { BookOpenCheck, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export function GenerateGuideButton({
  mode,
  label,
}: {
  mode: "full" | "stale";
  label: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function generate() {
    setBusy(true);
    try {
      const response = await fetch("/api/guides/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ onlyStale: mode === "stale" }),
      });
      const data = (await response.json()) as {
        error?: string;
        sectionsGenerated?: number;
        sectionsSkipped?: number;
        failures?: { topic: string; message: string }[];
      };
      if (!response.ok) throw new Error(data.error ?? `Request failed (${response.status}).`);
      const failed = data.failures?.length ?? 0;
      if (failed > 0) {
        toast.warning(
          `Generated ${data.sectionsGenerated} section(s); ${failed} failed: ${data.failures![0]!.topic} — ${data.failures![0]!.message}`,
        );
      } else {
        toast.success(
          `Generated ${data.sectionsGenerated} section(s)${data.sectionsSkipped ? `, kept ${data.sectionsSkipped} fresh` : ""}.`,
        );
      }
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Guide generation failed.");
    } finally {
      setBusy(false);
    }
  }

  const Icon = mode === "full" ? BookOpenCheck : RefreshCw;
  return (
    <Button onClick={generate} disabled={busy} variant={mode === "full" ? "default" : "outline"} className="gap-1.5">
      <Icon className={`size-4 ${busy ? "animate-spin" : ""}`} strokeWidth={1.75} />
      {busy ? "Generating…" : label}
    </Button>
  );
}
