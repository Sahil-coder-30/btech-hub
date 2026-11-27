"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, ExternalLink, FileText, RefreshCw, RotateCcw, Search, X } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/misc";
import {
  buildCircularSearchParams,
  CIRCULAR_PAGE_SIZE,
  hasActiveCircularFilters,
  normalizeCircularQuery,
  type CircularFilter,
  type CircularQuery,
} from "@/lib/circular-query";
import type { Circular } from "@/lib/circulars";
import { cn, formatDate } from "@/lib/utils";

type Props = {
  initialCirculars: Circular[];
  initialTotal: number;
  initialQuery: CircularQuery;
  departments: string[];
};

const DEBOUNCE_MS = 250;

function syncBrowserUrl(next: CircularQuery) {
  const qs = buildCircularSearchParams(next).toString();
  const targetUrl = qs ? `/circulars?${qs}` : "/circulars";
  if (`${window.location.pathname}${window.location.search}` !== targetUrl) {
    window.history.replaceState(null, "", targetUrl);
  }
}

function readQueryFromLocation(): CircularQuery {
  const sp = new URLSearchParams(window.location.search);
  return normalizeCircularQuery({
    q: sp.get("q") ?? "",
    dept: sp.get("dept") ?? "",
    filter: sp.get("filter") ?? "all",
    period: sp.get("period") ?? "all",
    sort: sp.get("sort") ?? "newest",
    page: sp.get("page") ?? "1",
  });
}

function useCircularsQuery({ initialCirculars, initialTotal, initialQuery }: Omit<Props, "departments">) {
  const [query, setQuery] = useState<CircularQuery>(initialQuery);
  const [searchInput, setSearchInput] = useState(initialQuery.q);
  const [circulars, setCirculars] = useState<Circular[]>(initialCirculars);
  const [total, setTotal] = useState(initialTotal);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const searchRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const latestQueryRef = useRef<CircularQuery>(initialQuery);

  const fetchCirculars = useCallback(
    async (next: CircularQuery, { scrollToTop = false, updateHistory = true }: { scrollToTop?: boolean; updateHistory?: boolean } = {}) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      latestQueryRef.current = next;

      setLoading(true);
      setError(null);
      if (updateHistory) syncBrowserUrl(next);

      try {
        const res = await fetch(`/api/circulars?${buildCircularSearchParams(next).toString()}`, { signal: controller.signal, cache: "no-store" });
        const data = (await res.json().catch(() => null)) as { circulars?: Circular[]; total?: number; error?: { message?: string } } | null;
        if (!res.ok || !data || !Array.isArray(data.circulars)) throw new Error(data?.error?.message || "Could not load circulars right now.");
        if (controller.signal.aborted) return;

        setCirculars(data.circulars);
        setTotal(typeof data.total === "number" ? data.total : data.circulars.length);
        if (scrollToTop) window.scrollTo({ top: 0, behavior: "smooth" });
      } catch (err) {
        if ((err as Error).name !== "AbortError") setError((err as Error).message || "Could not load circulars right now.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    },
    [],
  );

  const applyImmediate = useCallback(
    (patch: Partial<CircularQuery>, options?: { scrollToTop?: boolean }) => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }
      const next: CircularQuery = { ...latestQueryRef.current, ...patch };
      if ("q" in patch) setSearchInput(next.q);
      setQuery(next);
      void fetchCirculars(next, options);
    },
    [fetchCirculars],
  );

  const handleSearchChange = (value: string) => {
    setSearchInput(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const next: CircularQuery = { ...latestQueryRef.current, q: value.trim().slice(0, 100), page: 1 };
      setQuery(next);
      void fetchCirculars(next);
    }, DEBOUNCE_MS);
  };

  useEffect(() => {
    const onPopState = () => {
      const restored = readQueryFromLocation();
      setSearchInput(restored.q);
      setQuery(restored);
      void fetchCirculars(restored, { updateHistory: false });
    };
    window.addEventListener("popstate", onPopState);
    return () => {
      window.removeEventListener("popstate", onPopState);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      abortRef.current?.abort();
    };
  }, [fetchCirculars]);

  const resetAll = () => {
    applyImmediate({ q: "", dept: "", filter: "all", period: "all", sort: "newest", page: 1 });
    searchRef.current?.focus();
  };

  return { query, searchInput, circulars, total, loading, error, searchRef, fetchCirculars, applyImmediate, handleSearchChange, resetAll };
}

function CircularFilterForm({
  query,
  searchInput,
  departments,
  searchRef,
  onSearchChange,
  onApply,
}: {
  query: CircularQuery;
  searchInput: string;
  departments: string[];
  searchRef: React.RefObject<HTMLInputElement | null>;
  onSearchChange: (value: string) => void;
  onApply: (patch: Partial<CircularQuery>) => void;
}) {
  return (
    <form
      action="/circulars"
      onSubmit={(e) => {
        e.preventDefault();
        onApply({ q: searchInput.trim().slice(0, 100), page: 1 });
      }}
      className="mt-8 grid gap-3 sm:grid-cols-[1fr_220px_180px_auto]"
      role="search"
    >
      <div className="relative">
        <label className="sr-only" htmlFor="c-q">
          Search circulars
        </label>
        <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input
          ref={searchRef}
          id="c-q"
          name="q"
          type="search"
          value={searchInput}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search by title, e.g. exam, scholarship, carry over"
          className="pl-10 pr-9 [&::-webkit-search-cancel-button]:hidden"
        />
        {searchInput && (
          <button
            type="button"
            onClick={() => {
              onApply({ q: "", page: 1 });
              searchRef.current?.focus();
            }}
            aria-label="Clear search"
            className="absolute right-2 top-1/2 grid size-7 -translate-y-1/2 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X className="size-4" aria-hidden />
          </button>
        )}
      </div>

      <div>
        <label className="sr-only" htmlFor="c-dept">
          Department
        </label>
        <Select id="c-dept" name="dept" value={query.dept} onChange={(e) => onApply({ dept: e.target.value, page: 1 })}>
          <option value="">All departments</option>
          {departments.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </Select>
      </div>

      <div>
        <label className="sr-only" htmlFor="c-filter">
          Filter notices
        </label>
        <Select id="c-filter" name="filter" value={query.filter} onChange={(e) => onApply({ filter: e.target.value as CircularFilter, page: 1 })}>
          <option value="all">All notices</option>
          <option value="students">For students</option>
          <option value="deadlines">Has deadline</option>
          <option value="ready">AI summary ready</option>
        </Select>
      </div>

      <button type="submit" className={buttonVariants({ variant: "primary" })}>
        <Search aria-hidden /> Search
      </button>
    </form>
  );
}

function CircularListRow({ c }: { c: Circular }) {
  return (
    <li className="flex items-start gap-3 px-4 py-4 transition-colors hover:bg-muted/60 sm:px-5">
      <Link href={`/circulars/${c.id}`} className="min-w-0 flex-1 focus-visible:outline-none">
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          {c.published_on && (
            <time dateTime={c.published_on} className="num">
              {formatDate(c.published_on)}
            </time>
          )}
          {c.department && (
            <span className="inline-flex items-center rounded-md border border-border bg-surface px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
              {c.department}
            </span>
          )}
          {c.summary?.forStudents && <span>· For students</span>}
          {c.summary?.deadline && <span className="num">· Due {c.summary.deadline}</span>}
        </div>
        <p className="mt-1.5 font-medium leading-snug text-foreground">{c.title}</p>
        {c.summary?.gist && <p className="mt-1.5 line-clamp-2 text-sm text-muted-foreground">{c.summary.gist}</p>}
      </Link>
      <a
        href={c.pdf_url}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`Open original PDF for ${c.title}`}
        title="Open original PDF"
        className="icon-btn mt-0.5 shrink-0 text-muted-foreground hover:text-foreground"
      >
        <ExternalLink className="i i-s" aria-hidden />
      </a>
    </li>
  );
}

function CircularPagination({
  page,
  pages,
  loading,
  onPageChange,
}: {
  page: number;
  pages: number;
  loading: boolean;
  onPageChange: (nextPage: number) => void;
}) {
  if (pages <= 1) return null;

  return (
    <nav className="mt-6 flex items-center justify-between gap-3" aria-label="Pages">
      {page > 1 ? (
        <Button variant="outline" size="sm" disabled={loading} onClick={() => onPageChange(page - 1)}>
          <ChevronLeft aria-hidden /> Newer
        </Button>
      ) : (
        <span />
      )}
      <span className="text-sm text-muted-foreground num">
        Page {page} of {pages}
      </span>
      {page < pages ? (
        <Button variant="outline" size="sm" disabled={loading} onClick={() => onPageChange(page + 1)}>
          Older <ChevronRight aria-hidden />
        </Button>
      ) : (
        <span />
      )}
    </nav>
  );
}

/** Asks the server to pull fresh circulars from AKTU. The server allows one pull per 20 min for everyone. */
function RefreshFromAktu({ onRefreshed }: { onRefreshed: () => void }) {
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const refresh = async () => {
    setBusy(true);
    setNotice(null);
    try {
      const res = await fetch("/api/circulars/sync", { method: "POST" });
      const data = (await res.json().catch(() => null)) as { added?: number; error?: { message?: string } } | null;
      if (!res.ok) {
        setNotice(data?.error?.message || "Could not reach AKTU right now. Please try again later.");
        return;
      }
      const added = data?.added ?? 0;
      setNotice(added ? `${added} new circular${added === 1 ? "" : "s"} from AKTU.` : "You are up to date. No new circulars on AKTU.");
      if (added) onRefreshed();
    } catch {
      setNotice("Could not reach AKTU right now. Please try again later.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <p aria-live="polite" className="text-xs">
        {notice}
      </p>
      <Button size="sm" variant="outline" disabled={busy} onClick={() => void refresh()}>
        <RefreshCw className={cn("size-3.5", busy && "animate-spin")} aria-hidden />
        {busy ? "Checking AKTU..." : "Refresh"}
      </Button>
    </div>
  );
}

export function CircularsBrowser({ initialCirculars, initialTotal, initialQuery, departments }: Props) {
  const { query, searchInput, circulars, total, loading, error, searchRef, fetchCirculars, applyImmediate, handleSearchChange, resetAll } =
    useCircularsQuery({ initialCirculars, initialTotal, initialQuery });

  const pages = Math.max(1, Math.ceil(total / CIRCULAR_PAGE_SIZE));
  const activeFilters = hasActiveCircularFilters(query);

  return (
    <>
      <CircularFilterForm
        query={query}
        searchInput={searchInput}
        departments={departments}
        searchRef={searchRef}
        onSearchChange={handleSearchChange}
        onApply={(patch) => applyImmediate(patch)}
      />

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
        <p aria-live="polite" className="num">
          {total.toLocaleString("en-IN")} circular{total === 1 ? "" : "s"}
          {activeFilters ? " found" : ""}
          {loading ? " · Updating..." : ""}
        </p>
        <div className="flex flex-wrap items-center gap-3">
          {activeFilters && (
            <button type="button" onClick={resetAll} className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground">
              <RotateCcw className="size-3" aria-hidden /> Clear filters
            </button>
          )}
          <RefreshFromAktu onRefreshed={() => void fetchCirculars(query)} />
        </div>
      </div>

      {error && (
        <div role="alert" className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-danger/25 bg-danger/10 px-4 py-3 text-sm">
          <span>{error}</span>
          <Button size="sm" variant="secondary" onClick={() => void fetchCirculars(query)}>
            Try again
          </Button>
        </div>
      )}

      {circulars.length === 0 ? (
        <EmptyState
          className="mt-6"
          icon={FileText}
          title={activeFilters ? "No circular matches" : "No circulars yet"}
          description={activeFilters ? "Try a shorter word or clear your filters." : "Circulars are synced from AKTU every evening."}
          action={
            activeFilters ? (
              <Button size="sm" variant="secondary" onClick={resetAll}>
                Clear filters
              </Button>
            ) : undefined
          }
        />
      ) : (
        <ul className={cn("mt-4 divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card/60 transition-opacity", loading && "opacity-65")}>
          {circulars.map((c) => (
            <CircularListRow key={c.id} c={c} />
          ))}
        </ul>
      )}

      <CircularPagination page={query.page} pages={pages} loading={loading} onPageChange={(page) => applyImmediate({ page }, { scrollToTop: true })} />
    </>
  );
}
