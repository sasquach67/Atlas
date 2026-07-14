"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowRight, Search } from "lucide-react";
import type { ProcessingStatus, Source } from "@/lib/types";
import { humanize } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type SourceCard = Source & { claimCount: number };

export function SourcesClient({ sources }: { sources: SourceCard[] }) {
  const [query, setQuery] = useState("");
  const [platform, setPlatform] = useState("");
  const [status, setStatus] = useState("");
  const platforms = [...new Set(sources.map((source) => source.platform).filter(Boolean))];
  const statuses = [...new Set(sources.map((source) => source.processingStatus))];
  const filtered = useMemo(
    () =>
      sources.filter((source) => {
        const haystack = [source.title, source.creatorName, source.platform, source.description]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return (
          haystack.includes(query.toLowerCase()) &&
          (!platform || source.platform === platform) &&
          (!status || source.processingStatus === status)
        );
      }),
    [platform, query, sources, status],
  );

  return (
    <div className="grid gap-5 px-6 py-8 md:px-10">
      <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-card p-3">
        <div className="relative min-w-64 flex-1">
          <Search className="pointer-events-none absolute left-2 top-2 size-4 text-muted-foreground" />
          <Input
            aria-label="Search sources"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search sources"
            className="pl-8"
          />
        </div>
        <select
          aria-label="Platform filter"
          value={platform}
          onChange={(event) => setPlatform(event.target.value)}
          className="h-8 rounded-lg border border-input bg-background px-2 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <option value="">All platforms</option>
          {platforms.map((value) => (
            <option key={value} value={value ?? ""}>
              {value}
            </option>
          ))}
        </select>
        <select
          aria-label="Status filter"
          value={status}
          onChange={(event) => setStatus(event.target.value)}
          className="h-8 rounded-lg border border-input bg-background px-2 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <option value="">All statuses</option>
          {statuses.map((value) => (
            <option key={value} value={value}>
              {humanize(value)}
            </option>
          ))}
        </select>
      </div>

      {filtered.length === 0 ? (
        <p className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
          No sources match those filters.
        </p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((source) => (
            <Link key={source.id} href={`/sources/${source.id}`} className="group block">
              <Card className="h-full rounded-lg transition-colors group-hover:bg-muted/30">
                <CardHeader>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <CardTitle>{source.title}</CardTitle>
                      <CardDescription>
                        {source.creatorName ?? "Unknown creator"} - {source.platform ?? source.type}
                      </CardDescription>
                    </div>
                    <ArrowRight className="size-4 text-muted-foreground" strokeWidth={1.75} />
                  </div>
                </CardHeader>
                <CardContent className="flex flex-wrap gap-2">
                  <Badge variant="outline">{humanize(source.processingStatus as ProcessingStatus)}</Badge>
                  <Badge variant="secondary">{source.claimCount} claims</Badge>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
