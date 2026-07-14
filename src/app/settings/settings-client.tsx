"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Download, RotateCcw } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export function SettingsActions() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function reset() {
    setBusy(true);
    try {
      const response = await fetch("/api/admin/reset", { method: "POST" });
      if (!response.ok) throw new Error("Reset failed.");
      toast.success("Demo data reset.");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Reset failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      <a href="/api/export?format=json" className={buttonVariants({ variant: "outline" })}>
        <Download className="size-4" strokeWidth={1.75} />
        Export JSON
      </a>
      <a href="/api/export?format=markdown" className={buttonVariants({ variant: "outline" })}>
        <Download className="size-4" strokeWidth={1.75} />
        Export Markdown
      </a>
      <AlertDialog>
        <AlertDialogTrigger
          render={
            <Button type="button" variant="destructive" disabled={busy}>
              <RotateCcw className="size-4" strokeWidth={1.75} />
              Reset demo data
            </Button>
          }
        />
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset demo data?</AlertDialogTitle>
            <AlertDialogDescription>
              This deletes current rows and restores the seeded Premed Atlas demo workspace.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={reset}>
              Reset
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
