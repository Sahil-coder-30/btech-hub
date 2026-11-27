import { z } from "zod";
import { askCircularStream } from "@/lib/ai/circular-chat";
import { handler } from "@/lib/api";
import { HttpError, requireSession } from "@/lib/auth";
import { getCircular, getCircularText } from "@/lib/circulars";
import { clientKey, rateLimit } from "@/lib/rate-limit";

export const maxDuration = 60;

type Ctx = { params: Promise<{ id: string }> };

const bodySchema = z.object({
  question: z.string().trim().min(2).max(1000),
  history: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(4000) }))
    .max(12)
    .default([])
    .transform((turns) => turns.filter((t) => t.content.trim())),
});

/**
 * POST /api/circulars/[id]/ask: chat with one circular.
 * Streams NDJSON AskStreamEvent lines (meta, delta..., done), same as /api/ask.
 */
export const POST = handler(async (request: Request, ctx: Ctx) => {
  const session = await requireSession();
  const id = z.string().regex(/^[\w-]{3,80}$/).parse((await ctx.params).id);
  const body = bodySchema.parse(await request.json().catch(() => ({})));
  rateLimit(`circular-ask:${clientKey(request, session.id)}`, 20);

  const [circular, text] = await Promise.all([getCircular(id), getCircularText(id)]);
  if (!circular) throw new HttpError(404, "Circular not found.");
  if (!text) throw new HttpError(409, "This circular is still being read. Try again in a moment.");

  return new Response(askCircularStream({ circular, text, question: body.question, history: body.history, signal: request.signal }), {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store", "X-Accel-Buffering": "no" },
  });
});
