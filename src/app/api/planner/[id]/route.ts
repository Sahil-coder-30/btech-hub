import { NextResponse } from "next/server";
import { z } from "zod";
import { handler } from "@/lib/api";
import { HttpError, requireSession } from "@/lib/auth";
import { deletePlan, getPlan, updatePlan } from "@/lib/planner/store";

type Ctx = { params: Promise<{ id: string }> };

const planId = async (ctx: Ctx) => z.string().uuid().parse((await ctx.params).id);

/** GET /api/planner/[id]: one plan with all its tasks. */
export const GET = handler(async (_request: Request, ctx: Ctx) => {
  const session = await requireSession();
  const plan = await getPlan(session.id, await planId(ctx));
  if (!plan) throw new HttpError(404, "Plan not found.");
  return NextResponse.json({ plan });
});

const patchSchema = z
  .object({ title: z.string().trim().min(2).max(120).optional(), status: z.enum(["active", "archived"]).optional() })
  .refine((p) => p.title !== undefined || p.status !== undefined, { message: "Nothing to update" });

/** PATCH /api/planner/[id]: rename, archive or restore a plan. */
export const PATCH = handler(async (request: Request, ctx: Ctx) => {
  const session = await requireSession();
  await updatePlan(session.id, await planId(ctx), patchSchema.parse(await request.json()));
  return NextResponse.json({ ok: true });
});

/** DELETE /api/planner/[id]: remove a plan and its tasks. */
export const DELETE = handler(async (_request: Request, ctx: Ctx) => {
  const session = await requireSession();
  await deletePlan(session.id, await planId(ctx));
  return NextResponse.json({ ok: true });
});
