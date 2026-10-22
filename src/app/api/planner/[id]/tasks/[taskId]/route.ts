import { NextResponse } from "next/server";
import { z } from "zod";
import { handler } from "@/lib/api";
import { requireSession } from "@/lib/auth";
import { setTaskStatus } from "@/lib/planner/store";

type Ctx = { params: Promise<{ id: string; taskId: string }> };

const bodySchema = z.object({ status: z.enum(["todo", "done", "skipped"]) });

/** PATCH /api/planner/[id]/tasks/[taskId]: mark a task done, skipped or back to to-do. */
export const PATCH = handler(async (request: Request, ctx: Ctx) => {
  const session = await requireSession();
  const { id, taskId } = await ctx.params;
  const { status } = bodySchema.parse(await request.json());
  const task = await setTaskStatus(session.id, z.string().uuid().parse(id), z.string().uuid().parse(taskId), status);
  return NextResponse.json({ task });
});
