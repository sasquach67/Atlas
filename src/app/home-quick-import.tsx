"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

async function readError(response: Response): Promise<string> {
  const data = (await response.json().catch(() => null)) as { error?: string } | null;
  return data?.error ?? "Import failed.";
}

export function HomeQuickImport() {
  const router = useRouter();
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    if (!text.trim()) {
      toast.error("Paste advice text before importing.");
      return;
    }
    setSubmitting(true);
    try {
      const response = await fetch("/api/sources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "text", text, title: "Quick import" }),
      });
      if (!response.ok) throw new Error(await readError(response));
      toast.success("Quick import created.");
      router.push("/inbox");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Import failed.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="grid gap-3">
      <Textarea
        aria-label="Quick import text"
        value={text}
        onChange={(event) => setText(event.target.value)}
        rows={5}
        placeholder="Paste one piece of pre-med advice..."
      />
      <Button type="button" className="w-fit" onClick={submit} disabled={submitting}>
        <Send className="size-4" strokeWidth={1.75} />
        {submitting ? "Importing" : "Quick import"}
      </Button>
    </div>
  );
}
