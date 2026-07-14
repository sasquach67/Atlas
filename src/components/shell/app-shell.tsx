"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Compass,
  Inbox,
  Map,
  BookOpen,
  Library,
  FileStack,
  ListChecks,
  ShieldCheck,
  Settings,
  BookMarked,
  Menu,
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/", label: "Home", icon: Compass },
  { href: "/inbox", label: "Inbox", icon: Inbox },
  { href: "/atlas", label: "Atlas", icon: Map },
  { href: "/catalog", label: "Catalog", icon: BookOpen },
  { href: "/guides", label: "Guides", icon: BookMarked },
  { href: "/sources", label: "Sources", icon: FileStack },
  { href: "/actions", label: "Actions", icon: ListChecks },
  { href: "/verification", label: "Verification", icon: ShieldCheck },
  { href: "/settings", label: "Settings", icon: Settings },
] as const;

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav className="flex flex-col gap-0.5 px-3" aria-label="Main navigation">
      {NAV.map(({ href, label, icon: Icon }) => {
        const active =
          href === "/" ? pathname === "/" : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors",
              active
                ? "bg-sidebar-accent font-semibold text-sidebar-accent-foreground"
                : "text-sidebar-foreground/75 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
            )}
          >
            <Icon className="size-4 shrink-0" strokeWidth={1.75} />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

function Brand() {
  return (
    <Link href="/" className="flex items-center gap-2.5 px-6 py-5">
      <Library className="size-5 text-primary" strokeWidth={1.5} />
      <span className="font-display text-lg font-semibold tracking-tight">
        Premed Atlas
      </span>
    </Link>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex min-h-dvh w-full">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-dvh w-56 shrink-0 flex-col border-r border-sidebar-border bg-sidebar md:flex">
        <Brand />
        <NavLinks />
        <div className="mt-auto px-6 py-4">
          <p className="text-xs leading-relaxed text-muted-foreground">
            Advice is evidence,
            <br />
            not instruction.
          </p>
        </div>
      </aside>

      {/* Mobile top bar */}
      <div className="fixed inset-x-0 top-0 z-40 flex items-center justify-between border-b border-sidebar-border bg-sidebar/95 backdrop-blur-sm md:hidden">
        <Brand />
        <button
          type="button"
          aria-label={mobileOpen ? "Close menu" : "Open menu"}
          aria-expanded={mobileOpen}
          onClick={() => setMobileOpen((v) => !v)}
          className="mr-4 rounded-md p-2 hover:bg-sidebar-accent"
        >
          <Menu className="size-5" />
        </button>
      </div>
      {mobileOpen && (
        <div className="fixed inset-0 z-30 bg-sidebar pt-16 md:hidden">
          <NavLinks onNavigate={() => setMobileOpen(false)} />
        </div>
      )}

      <main className="min-w-0 flex-1 pt-16 md:pt-0">{children}</main>
    </div>
  );
}
