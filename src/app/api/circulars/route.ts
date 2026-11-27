import { NextResponse } from "next/server";
import { z } from "zod";
import { handler } from "@/lib/api";
import { requireSession } from "@/lib/auth";
import { CIRCULAR_FILTERS, CIRCULAR_PERIODS, CIRCULAR_SORTS, MAX_CIRCULAR_PAGE } from "@/lib/circular-query";
import { listCirculars, PAGE_SIZE } from "@/lib/circulars";
import { clientKey, rateLimit } from "@/lib/rate-limit";

const querySchema = z.object({
  q: z.string().trim().max(100).optional().default(""),
  dept: z.string().trim().max(100).optional().default(""),
  filter: z.enum(CIRCULAR_FILTERS).optional().default("all"),
  period: z.enum(CIRCULAR_PERIODS).optional().default("all"),
  sort: z.enum(CIRCULAR_SORTS).optional().default("newest"),
  page: z.coerce.number().int().min(1).max(MAX_CIRCULAR_PAGE).optional().default(1),
});

/** GET /api/circulars: live search, filter, sort, and paginated list of official AKTU circulars. */
export const GET = handler(async (request: Request) => {
  const session = await requireSession();
  rateLimit(`circulars-list:${clientKey(request, session.id)}`, 120);

  const sp = new URL(request.url).searchParams;
  const parsed = querySchema.parse({
    q: sp.get("q") ?? undefined,
    dept: sp.get("dept") ?? undefined,
    filter: sp.get("filter") || undefined,
    period: sp.get("period") || undefined,
    sort: sp.get("sort") || undefined,
    page: sp.get("page") || undefined,
  });

  const { circulars, total } = await listCirculars({
    q: parsed.q,
    department: parsed.dept,
    filter: parsed.filter,
    period: parsed.period,
    sort: parsed.sort,
    page: parsed.page,
  });
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return NextResponse.json(
    { circulars, total, page: parsed.page, pages, pageSize: PAGE_SIZE },
    { headers: { "Cache-Control": "private, no-store" } },
  );
});
