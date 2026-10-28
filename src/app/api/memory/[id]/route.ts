import { NextResponse } from "next/server";
import { z } from "zod";
import { handler } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { deleteMemory, MEMORY_KINDS, updateMemory } from "@/lib/profile";
import { clientKey, rateLimit } from "@/lib/rate-limit";

type Ctx = { params: Promise<{ id: string }> };

const patchSchema = z
  .object({
    kind: z.enum(MEMORY_KINDS),
    content: z.string().trim().min(3).max(300),
    pinned: z.boolean(),
  })
  .partial()
  .strict()
  .refine((patch) => Object.keys(patch).length > 0, { message: "Nothing to update." });

/** PATCH /api/memory/[id]: edit, pin or unpin one memory. */
export const PATCH = handler(async (request: Request, ctx: Ctx) => {
  const user = await requireUser();
  rateLimit(`memory-edit:${clientKey(request, user.id)}`, 60);
  const id = z.string().uuid().parse((await ctx.params).id);
  const patch = patchSchema.parse(await request.json());
  return NextResponse.json({ memory: await updateMemory(user.id, id, patch) });
});

/** DELETE /api/memory/[id]: forget one memory. */
export const DELETE = handler(async (_request: Request, ctx: Ctx) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  await deleteMemory(user.id, z.string().uuid().parse(id));
  return NextResponse.json({ ok: true });
});
