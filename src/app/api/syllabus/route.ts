import { NextResponse } from "next/server";
import { z } from "zod";
import { handler } from "@/lib/api";
import { HttpError } from "@/lib/auth";
import { getSyllabusInfo } from "@/lib/syllabus";

const querySchema = z.object({
  branch: z.string().trim().min(2).max(10),
  year: z.coerce.number().int().min(1).max(4),
});

/** GET /api/syllabus?branch=CSE&year=2 -> SyllabusInfo. Public, polled every few seconds while indexing. */
export const GET = handler(async (request: Request) => {
  const params = new URL(request.url).searchParams;
  const { branch, year } = querySchema.parse({ branch: params.get("branch"), year: params.get("year") });
  const info = await getSyllabusInfo(branch, year);
  if (!info) throw new HttpError(404, "Unknown branch.");
  // Cheap (cached on the server), and the status must never be stale while the client polls
  return NextResponse.json(info, { headers: { "Cache-Control": "private, no-store" } });
});
