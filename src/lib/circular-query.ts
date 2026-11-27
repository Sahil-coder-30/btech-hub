/**
 * Pure query, filter, period, and pagination helpers for AKTU circulars.
 * Shared across server components, API route handlers, client browser UI, and unit tests.
 */

export const CIRCULAR_PAGE_SIZE = 30;
export const MAX_CIRCULAR_PAGE = 1000;

export const CIRCULAR_FILTERS = ["all", "students", "deadlines", "ready"] as const;
export type CircularFilter = (typeof CIRCULAR_FILTERS)[number];

export const CIRCULAR_SORTS = ["newest", "oldest"] as const;
export type CircularSort = (typeof CIRCULAR_SORTS)[number];

export const NO_DEPARTMENT_VALUE = "__none__";

export const CIRCULAR_PERIODS = ["all", "7d", "30d", "90d", "2026", "2025", "2024", "older"] as const;
export type CircularPeriod = (typeof CIRCULAR_PERIODS)[number];

export type CircularQuery = {
  q: string;
  dept: string;
  filter: CircularFilter;
  period: CircularPeriod;
  sort: CircularSort;
  page: number;
};

export type CircularDepartmentCount = {
  department: string;
  count: number;
};

export type CircularStats = {
  total: number;
  ready: number;
  forStudents: number;
  withDeadline: number;
  uncategorized: number;
  latestDate: string | null;
};

function oneOf<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === "string" && (allowed as readonly string[]).includes(value) ? (value as T) : fallback;
}

/** Normalizes raw URL/API query parameters into safe bounded circular search options. */
export function normalizeCircularQuery(raw: {
  q?: unknown;
  dept?: unknown;
  filter?: unknown;
  period?: unknown;
  sort?: unknown;
  page?: unknown;
}): CircularQuery {
  const q = typeof raw.q === "string" ? raw.q.trim().slice(0, 100) : "";
  const dept = typeof raw.dept === "string" ? raw.dept.trim().slice(0, 100) : "";
  const filter = oneOf(raw.filter, CIRCULAR_FILTERS, "all");
  const period = oneOf(raw.period, CIRCULAR_PERIODS, "all");
  const sort = oneOf(raw.sort, CIRCULAR_SORTS, "newest");
  const parsedPage = Number(raw.page);
  const page = Number.isFinite(parsedPage) ? Math.max(1, Math.min(MAX_CIRCULAR_PAGE, Math.trunc(parsedPage))) : 1;
  return { q, dept, filter, period, sort, page };
}

/** Serializes non-default circular filters into compact URL search parameters. */
export function buildCircularSearchParams(query: Partial<CircularQuery>): URLSearchParams {
  const params = new URLSearchParams();
  if (query.q?.trim()) params.set("q", query.q.trim().slice(0, 100));
  if (query.dept?.trim()) params.set("dept", query.dept.trim().slice(0, 100));
  if (query.filter && query.filter !== "all") params.set("filter", query.filter);
  if (query.period && query.period !== "all") params.set("period", query.period);
  if (query.sort && query.sort !== "newest") params.set("sort", query.sort);
  if (query.page && query.page > 1) params.set("page", String(query.page));
  return params;
}

/** Escapes SQL ILIKE wildcards (`\`, `%`, `_`) so literal characters match literally. */
export function escapeLikePattern(text: string): string {
  return text.replace(/[\\%_]/g, (c) => `\\${c}`);
}

/**
 * Builds a PostgREST `.or()` filter expression across title, AI gist, and department.
 * Strips filter separator tokens (`,`, `(`, `)`) so arbitrary user queries cannot break parsing.
 */
export function buildCircularOrFilter(rawQuery: string): string | null {
  const cleaned = rawQuery.replace(/[,()]/g, " ").replace(/\s+/g, " ").trim();
  if (!cleaned) return null;
  const pattern = `%${escapeLikePattern(cleaned)}%`;
  const quoted = `"${pattern.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
  return `title.ilike.${quoted},summary->>gist.ilike.${quoted},department.ilike.${quoted}`;
}

function isoDateDaysAgo(days: number, now: Date): string {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - days));
  return d.toISOString().slice(0, 10);
}

/** Resolves inclusive `YYYY-MM-DD` date bounds for a period filter. */
export function periodDateBounds(period: CircularPeriod, now = new Date()): { gte?: string; lte?: string; lt?: string } | null {
  switch (period) {
    case "all":
      return null;
    case "7d":
      return { gte: isoDateDaysAgo(7, now) };
    case "30d":
      return { gte: isoDateDaysAgo(30, now) };
    case "90d":
      return { gte: isoDateDaysAgo(90, now) };
    case "2026":
    case "2025":
    case "2024":
      return { gte: `${period}-01-01`, lte: `${period}-12-31` };
    case "older":
      return { lt: "2024-01-01" };
  }
}

/** Compact numbered pagination sequence with `"ellipsis"` gaps. */
export function paginationRange(current: number, totalPages: number): Array<number | "ellipsis"> {
  if (totalPages <= 1) return [1];
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);

  const pages: Array<number | "ellipsis"> = [1];
  const start = Math.max(2, current - 1);
  const end = Math.min(totalPages - 1, current + 1);

  if (start > 2) pages.push("ellipsis");
  for (let p = start; p <= end; p++) pages.push(p);
  if (end < totalPages - 1) pages.push("ellipsis");
  pages.push(totalPages);

  return pages;
}

export function hasActiveCircularFilters(query: Pick<CircularQuery, "q" | "dept" | "filter" | "period" | "sort">): boolean {
  return Boolean(
    query.q ||
      query.dept ||
      query.filter !== "all" ||
      query.period !== "all" ||
      query.sort !== "newest",
  );
}
