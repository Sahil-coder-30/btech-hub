import { NextResponse } from "next/server";
import { z } from "zod";
import { handler } from "@/lib/api";
import { getCurrentUser, requireUser } from "@/lib/auth";
import { invalidateStudentContext } from "@/lib/profile";
import { db } from "@/lib/supabase";

/** GET /api/me: current user or null. */
export const GET = handler(async () => {
  const user = await getCurrentUser();
  return NextResponse.json({ user });
});

const patchSchema = z.object({
  branch_code: z.enum(["CSE", "CSEAIML", "CSEDS", "IT", "ECE", "EE", "EEE", "ME", "CE"]).nullable(),
  year: z.number().int().min(1).max(4).nullable(),
});

/** PATCH /api/me: update branch and year used to personalise Vac and the tools. */
export const PATCH = handler(async (request: Request) => {
  const user = await requireUser();
  const body = patchSchema.parse(await request.json());
  const { data, error } = await db().from("users").update(body).eq("id", user.id).select("*").single();
  if (error) throw error;
  // Branch and year are part of Vac's context
  invalidateStudentContext(user.id);
  return NextResponse.json({ user: data });
});
