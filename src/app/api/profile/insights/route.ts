import { NextResponse } from "next/server";
import { handler } from "@/lib/api";
import { HttpError, requireUser } from "@/lib/auth";
import { getProfile, getResultRecords, refreshInsights } from "@/lib/profile";
import { clientKey, rateLimit } from "@/lib/rate-limit";

export const maxDuration = 60;

/** POST /api/profile/insights: regenerate AI insights from the latest results and goals. */
export const POST = handler(async (request: Request) => {
  const user = await requireUser();
  rateLimit(clientKey(request, user.id), 3);
  const profile = await getProfile(user.id);
  if (!profile) throw new HttpError(400, "Finish onboarding first.");
  return NextResponse.json(await refreshInsights(user, profile, await getResultRecords(user.id)));
});
