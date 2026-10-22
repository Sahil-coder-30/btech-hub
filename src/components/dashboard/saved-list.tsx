"use client";

import Link from "next/link";
import { useState } from "react";
import { BookmarkX, ExternalLink, Library, Search } from "lucide-react";
import { toast } from "sonner";
import { buttonVariants } from "@/components/ui/button";
import { DashHeader, DashPage, EmptyHint, accentStyle, type Accent } from "@/components/dashboard/ui";
import type { Resource, ResourceType } from "@/lib/types";
import { cn } from "@/lib/utils";

const TYPES: Record<ResourceType, { label: string; accent: Accent }> = {
  notes: { label: "Notes", accent: "violet" },
  pyq: { label: "PYQ", accent: "amber" },
  lecture: { label: "Lecture", accent: "cyan" },
  imp_question: { label: "Important Qs", accent: "rose" },
  other: { label: "Other", accent: "blue" },
};
const TYPE_KEYS = Object.keys(TYPES) as ResourceType[];

/** Bookmarked notes, PYQs and lectures, with filters and one tap to open or remove. */
export function SavedList({ initial }: { initial: Resource[] }) {
  const [items, setItems] = useState(initial);
  const [type, setType] = useState<ResourceType | "all">("all");
  const [query, setQuery] = useState("");

  const q = query.trim().toLowerCase();
  const shown = items.filter(
    (r) => (type === "all" || r.type === type) && (!q || [r.subject_title, r.subject_code, r.label].some((p) => p?.toLowerCase().includes(q))),
  );

  const remove = async (r: Resource) => {
    const before = items;
    setItems(items.filter((x) => x.id !== r.id));
    const res = await fetch("/api/resources/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resourceId: r.id }),
    }).catch(() => null);
    const body = res?.ok ? await res.json().catch(() => ({})) : null;
    if (body && body.saved === false) {
      toast.success("Removed from saved");
    } else {
      setItems(before);
      // The endpoint toggles, so a "saved: true" reply means it was not saved before. Undo that.
      if (body?.saved) await fetch("/api/resources/save", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ resourceId: r.id }) }).catch(() => null);
      toast.error(res ? "Could not remove. Please try again." : "Network error");
    }
  };

  const chips: { key: ResourceType | "all"; label: string; count: number }[] = [
    { key: "all", label: "All", count: items.length },
    ...TYPE_KEYS.map((k) => ({ key: k, label: TYPES[k].label, count: items.filter((r) => r.type === k).length })),
  ];

  return (
    <DashPage>
      <DashHeader
        title="Saved resources"
        description="Notes, PYQs and lectures you bookmarked."
        actions={
          <Link href="/resources" className={buttonVariants({ variant: "secondary", size: "sm" })}>
            <Library /> Browse more
          </Link>
        }
      />

      {items.length === 0 ? (
        <div className="mt-6">
          <EmptyHint
            icon={Library}
            accent="violet"
            title="Nothing saved yet"
            text="Tap the bookmark on any note or PYQ to keep it here."
            action={
              <Link href="/resources" className={buttonVariants({ size: "sm" })}>
                Browse resources
              </Link>
            }
          />
        </div>
      ) : (
        <>
          <div className="mt-6 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by type">
              {chips.map((c) => (
                <button
                  key={c.key}
                  type="button"
                  aria-pressed={type === c.key}
                  onClick={() => setType(c.key)}
                  className={cn(
                    "inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    type === c.key ? "border-primary/40 bg-accent text-accent-foreground" : "border-border bg-card text-muted-foreground hover:text-foreground",
                  )}
                >
                  {c.label}
                  <span className="font-mono tabular-nums opacity-70">{c.count}</span>
                </button>
              ))}
            </div>

            <label className="relative block lg:w-72">
              <span className="sr-only">Search saved resources</span>
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by subject or code"
                className="h-10 w-full rounded-xl border border-border bg-card pl-9 pr-3 text-sm outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
              />
            </label>
          </div>

          {shown.length === 0 ? (
            <div className="mt-5">
              <EmptyHint icon={Search} accent="blue" title="No match" text="Try another filter or search word." />
            </div>
          ) : (
            <ul className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {shown.map((r) => {
                const meta = TYPES[r.type] ?? TYPES.other;
                return (
                  <li key={r.id} className="flex min-w-0 flex-col rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow)] transition-colors hover:border-border-strong">
                    <div className="flex items-center justify-between gap-2">
                      <span
                        style={accentStyle(meta.accent)}
                        className="inline-flex h-6 items-center rounded-full bg-[color-mix(in_oklab,var(--a)_14%,transparent)] px-2.5 text-xs font-semibold text-[var(--a)]"
                      >
                        {meta.label}
                      </span>
                      <span className="font-mono text-[11px] text-muted-foreground">Sem {r.semester}</span>
                    </div>
                    <p className="mt-3 line-clamp-2 font-medium">{r.subject_title || r.label}</p>
                    <p className="mt-1 truncate text-xs text-muted-foreground">
                      {r.subject_code ? `${r.subject_code} · ` : ""}
                      {r.label}
                    </p>
                    <div className="mt-4 flex items-center gap-2 pt-1">
                      {r.url ? (
                        <a href={r.url} target="_blank" rel="noopener noreferrer" className={buttonVariants({ size: "sm", className: "flex-1" })}>
                          <ExternalLink /> Open
                        </a>
                      ) : (
                        <span aria-disabled="true" className={buttonVariants({ variant: "secondary", size: "sm", className: "flex-1 cursor-not-allowed opacity-60" })}>
                          Coming soon
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => remove(r)}
                        aria-label={`Remove ${r.subject_title || r.label} from saved`}
                        className={buttonVariants({ variant: "ghost", size: "sm", className: "text-muted-foreground hover:text-danger" })}
                      >
                        <BookmarkX /> Remove
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}
    </DashPage>
  );
}
