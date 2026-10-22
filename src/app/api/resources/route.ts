import { NextResponse } from "next/server";
import { handler } from "@/lib/api";
import { requireSession } from "@/lib/auth";
import { getResources } from "@/lib/data";

/** GET /api/resources?year=&semester=&branch=&q= : resource listing for logged-in students. */
export const GET = handler(async (request: Request) => {
  await requireSession();
  const p = new URL(request.url).searchParams;
  const year = Number(p.get("year")) || 1;
  const resources = await getResources({
    year,
    semester: Number(p.get("semester")) || undefined,
    branch: p.get("branch") || undefined,
    search: p.get("q") || undefined,
    limit: 1000,
  });
  return NextResponse.json({ resources });
});
