import { NextResponse } from "next/server";
import { z } from "zod";
import { handler } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { getSemesterPlan } from "@/lib/profile";

const querySchema = z.object({
  branch: z.enum(["CSE", "CSEAIML", "CSEDS", "IT", "ECE", "EE", "EEE", "ME", "CE"]),
  semester: z.coerce.number().int().min(1).max(8),
});

/** GET /api/onboarding/subjects?branch=&semester=: subjects and elective slots for the picker. */
export const GET = handler(async (request: Request) => {
  await requireUser();
  const params = new URL(request.url).searchParams;
  const { branch, semester } = querySchema.parse({ branch: params.get("branch"), semester: params.get("semester") });
  return NextResponse.json(await getSemesterPlan(branch, semester));
});
