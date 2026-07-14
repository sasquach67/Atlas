"use client";

import { useEffect, useState } from "react";
import type { Claim, Source, Transcript } from "@/lib/types";
import { ReviewClient } from "./review-client";

type ReviewPayload = {
  source: Source;
  transcript: Transcript | null;
  claims: Claim[];
};

export function ReviewLoader({ sourceId }: { sourceId: string }) {
  const [payload, setPayload] = useState<{
    source: Source;
    transcript: Transcript;
    claims: Claim[];
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      for (let attempt = 0; attempt < 20; attempt++) {
        const controller = new AbortController();
        const timeout = window.setTimeout(() => controller.abort(), 1500);
        try {
          const response = await fetch(`/api/sources/${sourceId}`, {
            cache: "no-store",
            signal: controller.signal,
          });
          if (response.ok) {
            const data = (await response.json()) as ReviewPayload;
            if (data.transcript) {
              if (!cancelled) {
                setPayload({
                  source: data.source,
                  transcript: data.transcript,
                  claims: data.claims,
                });
              }
              return;
            }
          }
        } catch {
          // Retry below; fresh imports can race across Next dev workers.
        } finally {
          window.clearTimeout(timeout);
        }
        await new Promise((resolve) => window.setTimeout(resolve, 500));
      }
      if (!cancelled) setError("This source is not available yet. Return to the Inbox and retry.");
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [sourceId]);

  if (error) {
    return <p className="px-6 py-8 text-sm text-destructive md:px-10">{error}</p>;
  }
  if (!payload) {
    return <p className="px-6 py-8 text-sm text-muted-foreground md:px-10">Loading review...</p>;
  }
  return (
    <ReviewClient
      source={payload.source}
      transcript={payload.transcript}
      initialClaims={payload.claims}
    />
  );
}
