import { after, NextResponse } from "next/server";
import { z } from "zod";
import { handler } from "@/lib/api";
import { HttpError, requireSession } from "@/lib/auth";
import { claimCircular, getCircular, processCircular } from "@/lib/circulars";
import { clientKey, rateLimit } from "@/lib/rate-limit";

// Reading a scanned circular (download, Gemini vision, summary) runs in after() and needs the budget
export const maxDuration = 300;

type Ctx = { params: Promise<{ id: string }> };

const circularId =async (ctx: Ctx) => z.string().regex(/^[\w-]{3,80}$/).parse((await ctx.params).id);

async function found(id: string) {
  const circular = await getCircular(id);
  if (!circular) throw new HttpError(404, "Circular not found.");
  return circular;
}

/** GET /api/circulars/[id]: status and summary, polled while the circular is being read. */
export const GET = handler(async (_request: Request, ctx: Ctx) => {
  await requireSession();
  return NextResponse.json({ circular: await found(await circularId(ctx)) }, { headers: { "Cache-Control": "private, no-store" } });
});

/**
 * POST /api/circulars/[id]: start reading and summarising this circular once.
 * Idempotent: a ready or already running circular is left alone.
 */
export const POST = handler(async (request: Request, ctx: Ctx) => {
  const session = await requireSession();
  const id = await circularId(ctx);
  rateLimit(`circular-prep:${clientKey(request, session.id)}`, 6);
  const current = await found(id);
  if (current.status !== "ready" && (await claimCircular(id))) after(() => processCircular(id));
  return NextResponse.json({ circular: await found(id) }, { headers: { "Cache-Control": "private, no-store" } });
});
