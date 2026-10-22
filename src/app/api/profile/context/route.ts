import { NextResponse } from "next/server";
import { handler } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { getContextPreview } from "@/lib/profile";

/** GET /api/profile/context: the exact profile and memory block Vac receives, after preferences. */
export const GET = handler(async () => {
  const user = await requireUser();
  return NextResponse.json(await getContextPreview(user));
});
