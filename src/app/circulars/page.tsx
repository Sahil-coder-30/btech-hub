import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, ChevronRight, FileText, Megaphone, Search, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { circularDepartments, listCirculars, PAGE_SIZE } from "@/lib/circulars";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = {
  title: "AKTU Circulars",
  description: "Every official AKTU circular with a short AI summary. Ask anything about a circular in simple English or Hinglish.",
};
export const dynamic = "force-dynamic";

type SearchParams = Promise<{ q?: string; dept?: string; page?: string }>;

export default async function CircularsPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const q = (params.q ?? "").trim().slice(0, 100);
  const dept = (params.dept ?? "").trim().slice(0, 100);
  const page = Math.max(1, Math.min(1000, Number(params.page) || 1));
  const [{ circulars, total }, departments] = await Promise.all([listCirculars({ q, department: dept, page }), circularDepartments()]);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const href = (p: number) => `/circulars?${new URLSearchParams({ ...(q && { q }), ...(dept && { dept }), page: String(p) })}`;

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <PageHeader
        eyebrow="AKTU"
        icon={Megaphone}
        title="Circulars"
        description="Official AKTU circulars, newest first. Open one to see what it means in two lines, then ask anything about it."
      />

      <form action="/circulars" className="mt-8 grid gap-3 sm:grid-cols-[1fr_240px_auto]" role="search">
        <label className="sr-only" htmlFor="c-q">
          Search circulars
        </label>
        <Input id="c-q" name="q" type="search" defaultValue={q} placeholder="Search by title, e.g. exam, scholarship, carry over" />
        <label className="sr-only" htmlFor="c-dept">
          Department
        </label>
        <Select id="c-dept" name="dept" defaultValue={dept}>
          <option value="">All departments</option>
          {departments.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </Select>
        <button type="submit" className={buttonVariants({ variant: "primary" })}>
          <Search aria-hidden /> Search
        </button>
      </form>

      <p className="mt-4 text-sm text-muted-foreground" aria-live="polite">
        {total.toLocaleString("en-IN")} circular{total === 1 ? "" : "s"}
        {q || dept ? " found" : ""}
      </p>

      {circulars.length === 0 ? (
        <EmptyState
          className="mt-6"
          icon={FileText}
          title={q || dept ? "No circular matches" : "No circulars yet"}
          description={q || dept ? "Try a shorter word or another department." : "Circulars are synced from AKTU every evening."}
        />
      ) : (
        <ul className="mt-4 divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card/60">
          {circulars.map((c) => (
            <li key={c.id}>
              <Link href={`/circulars/${c.id}`} className="block px-4 py-4 transition-colors hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:outline-none sm:px-5">
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  {c.published_on && <time dateTime={c.published_on}>{formatDate(c.published_on)}</time>}
                  {c.department && <Badge variant="secondary">{c.department}</Badge>}
                  {c.summary?.forStudents && <Badge variant="success">For students</Badge>}
                </div>
                <p className="mt-1.5 font-medium leading-snug">{c.title}</p>
                {c.summary?.gist && (
                  <p className="mt-1.5 flex gap-1.5 text-sm text-muted-foreground">
                    <Sparkles className="mt-0.5 size-3.5 shrink-0 text-primary" aria-label="AI summary" />
                    <span className="line-clamp-2">{c.summary.gist}</span>
                  </p>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}

      {pages > 1 && (
        <nav className="mt-6 flex items-center justify-between gap-3" aria-label="Pages">
          {page > 1 ? (
            <Link href={href(page - 1)} className={buttonVariants({ variant: "outline", size: "sm" })}>
              <ChevronLeft aria-hidden /> Newer
            </Link>
          ) : (
            <span />
          )}
          <span className="text-sm text-muted-foreground num">
            Page {page} of {pages}
          </span>
          {page < pages ? (
            <Link href={href(page + 1)} className={buttonVariants({ variant: "outline", size: "sm" })}>
              Older <ChevronRight aria-hidden />
            </Link>
          ) : (
            <span />
          )}
        </nav>
      )}
    </div>
  );
}
