"use client";

import { Fragment, useMemo, useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { formatTimestamp, humanize } from "@/lib/format";

export interface CitationClaim {
  id: string;
  canonicalText: string;
  verificationStatus: string;
  evidenceLevel: string;
  sourceId: string | null;
  sourceTitle: string | null;
  timestampStart: number | null;
}

const CITATION_SPLIT = /(\[\^[\w-]+\])/g;
const BOLD_SPLIT = /(\*\*[^*]+\*\*)/g;

function InlineText({ text }: { text: string }) {
  return (
    <>
      {text.split(BOLD_SPLIT).map((part, index) =>
        part.startsWith("**") && part.endsWith("**") ? (
          <strong key={index}>{part.slice(2, -2)}</strong>
        ) : (
          <Fragment key={index}>{part}</Fragment>
        ),
      )}
    </>
  );
}

function Citation({
  claim,
  index,
}: {
  claim: CitationClaim | undefined;
  index: number;
}) {
  const [open, setOpen] = useState(false);
  if (!claim) return null;
  return (
    <span className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        onBlur={() => window.setTimeout(() => setOpen(false), 150)}
        aria-expanded={open}
        aria-label={`Citation ${index}: ${claim.canonicalText}`}
        className="mx-0.5 inline-flex size-4.5 -translate-y-1 items-center justify-center rounded-full border border-border bg-secondary align-middle font-mono text-[10px] leading-none text-secondary-foreground transition-colors hover:bg-accent"
      >
        {index}
      </button>
      {open ? (
        <span className="absolute bottom-full left-1/2 z-20 mb-2 block w-72 -translate-x-1/2 rounded-lg border border-border bg-popover p-3 text-left shadow-lg">
          <span className="block text-sm leading-snug text-popover-foreground">
            {claim.canonicalText}
          </span>
          <span className="mt-1.5 block text-xs text-muted-foreground">
            {humanize(claim.verificationStatus)} · {humanize(claim.evidenceLevel)}
            {claim.sourceTitle ? (
              <>
                {" · "}
                {claim.sourceTitle}
                {claim.timestampStart != null ? ` @ ${formatTimestamp(claim.timestampStart)}` : ""}
              </>
            ) : null}
          </span>
          <span className="mt-2 flex gap-3 text-xs">
            {claim.sourceId ? (
              <Link
                href={`/sources/${claim.sourceId}${claim.timestampStart != null ? `?t=${claim.timestampStart}` : ""}`}
                className="text-primary underline underline-offset-4"
              >
                View in source
              </Link>
            ) : null}
            <Link
              href={`/atlas?claim=${claim.id}`}
              className="text-primary underline underline-offset-4"
            >
              Open in Atlas
            </Link>
          </span>
        </span>
      ) : null}
    </span>
  );
}

function RichLine({
  text,
  citationIndex,
  claims,
}: {
  text: string;
  citationIndex: Map<string, number>;
  claims: Map<string, CitationClaim>;
}) {
  return (
    <>
      {text.split(CITATION_SPLIT).map((part, index) => {
        const match = /^\[\^([\w-]+)\]$/.exec(part);
        if (match) {
          const id = match[1]!;
          return <Citation key={index} claim={claims.get(id)} index={citationIndex.get(id) ?? 0} />;
        }
        return <InlineText key={index} text={part} />;
      })}
    </>
  );
}

/**
 * Renders the constrained markdown our guide providers emit: paragraphs,
 * "Sources disagree" blockquotes, bold, and [^claimId] citation chips.
 * All content is rendered as text — no raw HTML ever reaches the DOM.
 */
export function SectionBody({
  markdown,
  claims,
}: {
  markdown: string;
  claims: CitationClaim[];
}) {
  const claimMap = useMemo(() => new Map(claims.map((claim) => [claim.id, claim])), [claims]);
  const citationIndex = useMemo(() => {
    const index = new Map<string, number>();
    let counter = 0;
    for (const match of markdown.matchAll(/\[\^([\w-]+)\]/g)) {
      if (!index.has(match[1]!)) index.set(match[1]!, ++counter);
    }
    return index;
  }, [markdown]);

  const blocks = useMemo(() => {
    const lines = markdown.split("\n");
    const result: { type: "p" | "quote"; text: string }[] = [];
    let buffer: string[] = [];
    let bufferType: "p" | "quote" | null = null;
    const flush = () => {
      if (buffer.length > 0 && bufferType) {
        result.push({ type: bufferType, text: buffer.join(" ") });
      }
      buffer = [];
      bufferType = null;
    };
    for (const raw of lines) {
      const line = raw.trim();
      if (!line) {
        flush();
        continue;
      }
      const isQuote = line.startsWith(">");
      const type = isQuote ? "quote" : "p";
      if (bufferType && bufferType !== type) flush();
      bufferType = type;
      buffer.push(isQuote ? line.replace(/^>\s?/, "") : line);
    }
    flush();
    return result;
  }, [markdown]);

  return (
    <div className="grid gap-3">
      {blocks.map((block, index) =>
        block.type === "quote" ? (
          <blockquote
            key={index}
            className={cn(
              "rounded-r-md border-l-2 border-destructive/50 bg-destructive/5 py-2 pl-4 pr-3 text-sm leading-relaxed",
            )}
          >
            <RichLine text={block.text} citationIndex={citationIndex} claims={claimMap} />
          </blockquote>
        ) : (
          <p key={index} className="text-[15px] leading-relaxed">
            <RichLine text={block.text} citationIndex={citationIndex} claims={claimMap} />
          </p>
        ),
      )}
    </div>
  );
}
