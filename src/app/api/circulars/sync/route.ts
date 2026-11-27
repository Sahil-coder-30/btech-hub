import { timingSafeEqual } from "node:crypto";
import { after, NextResponse } from "next/server";
import { handler } from "@/lib/api";
import { requireAdmin, requireSession } from "@/lib/auth";
import { claimCircular, claimRefresh, markSynced, pendingRecentIds, processCircular, releaseRefresh, syncCirculars } from "@/lib/circulars";

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

/** Pulls the AKTU list, then summarises the newest few in the background. */
async function syncAndPrepare() {
  const result = await syncCirculars();
  const ids = await pendingRecentIds(PREPARE_AHEAD);
  // One at a time: each may call Gemini vision, and parallel calls hit the rate limit
  after(async () => {
    for (const id of ids) if (await claimCircular(id)) await processCircular(id);
  });
  return { ...result, preparing: ids.length };
}

/**
 * GET /api/circulars/sync: called by Vercel Cron once a day at 17:00 IST, when most circulars are
 * out (Authorization: Bearer CRON_SECRET), or opened by a logged-in admin. Always runs.
 */
export const GET = handler(async (request: Request) => {
  if (!isCron(request)) await requireAdmin();
  const result = await syncAndPrepare();
  await markSynced();
  return NextResponse.json(result);
});

/**
 * POST /api/circulars/sync: the refresh button for any logged-in student. At most one AKTU sync
 * per 20 minutes for the whole site, otherwise 429 with the wait time.
 */
export const POST = handler(async () => {
  await requireSession();
  const claimedAt = Date.now();
  const previous = await claimRefresh(claimedAt);
  try {
    return NextResponse.json(await syncAndPrepare());
  } catch (err) {
    // AKTU down or slow: hand the slot back so the next student can try again
    await releaseRefresh(claimedAt, previous).catch(() => {});
    throw err;
  }
});
