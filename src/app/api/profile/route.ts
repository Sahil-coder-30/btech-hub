import { NextResponse } from "next/server";
import { academicPatchSchema, getAcademicData, updateAcademic } from "@/lib/account";
import { handler } from "@/lib/api";
import { requireUser } from "@/lib/auth";

/** GET /api/profile: academic profile, elective slots, completeness and stats. */
export const GET = handler(async () => {
  const user = await requireUser();
  return NextResponse.json(await getAcademicData(user));
});

/** PATCH /api/profile: partial academic update. Returns the fresh payload so the client never refetches. */
export const PATCH = handler(async (request: Request) => {
  const user = await requireUser();
  const body = academicPatchSchema.parse(await request.json().catch(() => null));
  return NextResponse.json(await updateAcademic(user, body));
});
