import { NextResponse } from "next/server";
import { z } from "zod";
import { handler } from "@/lib/api";
import { requireSession } from "@/lib/auth";
import { MAX_PLAN_DAYS } from "@/lib/planner/schedule";
import { replan } from "@/lib/planner/store";
import { clientKey, rateLimit } from "@/lib/rate-limit";

type Ctx = { params: Promise<{ id: string }> };

const bodySchema = z.object({
  availability: z
    .object({
      weekdayHours: z.number().min(0).max(14),
      weekendHours: z.number().min(0).max(14),
      offDays: z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).max(MAX_PLAN_DAYS),
    })
    .refine((a) => a.weekdayHours > 0 || a.weekendHours > 0, { message: "Add some study hours" })
    .optional(),
});

/** POST /api/planner/[id]/replan: move unfinished tasks into the days left. No AI call. */
export const POST = handler(async (request: Request, ctx: Ctx) => {
  const session = await requireSession();
  rateLimit(clientKey(request, session.id), 10);
  const id = z.string().uuid().parse((await ctx.params).id);
  const { availability } = bodySchema.parse(await request.json().catch(() => ({})));
  return NextResponse.json(await replan(session.id, id, availability));
});
