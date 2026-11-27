import { timingSafeEqual } from "node:crypto";
import { after, NextResponse } from "next/server";
import { handler } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";
import { claimCircular, pendingRecentIds, processCircular, syncCirculars } from "@/lib/circulars";

export const maxDuration = 300;

/** How many of the newest new circulars get their summary ready ahead of time on each run. */
const PREPARE_AHEAD = 5;

function isCron(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const got = Buffer.from(request.headers.get("authorization") ?? "");
  const want = Buffer.from(`Bearer ${secret}`);
  return got.length === want.length && timingSafeEqual(got, want);
}

/**
 * GET /api/circulars/sync: pull the AKTU circular list, then summarise the newest few.
 * Called daily by Vercel Cron (Authorization: Bearer CRON_SECRET), or opened by a logged-in admin.
 */
export const GET = handler(async (request: Request) => {
  if (!isCron(request)) await requireAdmin();
  const result = await syncCirculars();
  const ids = await pendingRecentIds(PREPARE_AHEAD);
  // One at a time: each may call Gemini vision, and parallel calls hit the rate limit
  after(async () => {
    for (const id of ids) if (await claimCircular(id)) await processCircular(id);
  });
  return NextResponse.json({ ...result, preparing: ids.length });
});
