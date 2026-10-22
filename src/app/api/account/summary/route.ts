import { NextResponse } from "next/server";
import { getDataSummary } from "@/lib/account";
import { handler } from "@/lib/api";
import { requireSession } from "@/lib/auth";

/** GET /api/account/summary: how many rows the student has in each table. */
export const GET = handler(async () => {
  const session = await requireSession();
  return NextResponse.json(await getDataSummary(session.id));
});
