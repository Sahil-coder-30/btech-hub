import { logger } from "faultkit";
import { NextResponse } from "next/server";
import { z } from "zod";
import { runVacAgent } from "@/lib/ai/agent";
import { solveDoubt } from "@/lib/ai/generators";
import { handler, readJson } from "@/lib/api";
import { HttpError, requireUser } from "@/lib/auth";
import { buildStudentContext } from "@/lib/profile";
import { clientKey, rateLimit } from "@/lib/rate-limit";
import { readPreferences } from "@/lib/settings";
import { db } from "@/lib/supabase";

export const maxDuration = 60;

const IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp", "image/heic"] as const;

const bodySchema = z.object({
  sessionId: z.string().min(8).max(64),
  messages: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(4000) }))
    .min(1)
    .max(30),
  image: z
    .object({
      mimeType: z.enum(IMAGE_TYPES),
      base64: z.string().min(1).max(7_000_000),
    })
    .optional(),
});

/** POST /api/chat: one turn of the Vac agent (or multimodal photo doubt solve when image is attached). */
export const POST = handler(async (request: Request) => {
  const user = await requireUser();
  const { sessionId, messages, image } = bodySchema.parse(await readJson(request));
  const latest = messages[messages.length - 1];
  if (!image && !latest?.content.trim()) throw new HttpError(400, "Type a message or attach a photo.");

  rateLimit(`chat:${clientKey(request, user.id)}`, 20);

  const history = messages.slice(-12);
  if (history[0]?.role === "assistant") history.shift();

  const prefs = readPreferences(user);
  const context = prefs.vac.useProfile ? await buildStudentContext(user).catch(() => null) : null;

  let reply: string;
  let tools: string[];
  if (image) {
    reply = await solveDoubt(latest.content, image, history.slice(0, -1));
    tools = ["Photo solver"];
  } else {
    ({ reply, tools } = await runVacAgent(history, user, context, prefs.vac));
  }

  if (prefs.privacy.saveChatHistory) {
    const loggedQuestion = latest.content.trim() || "[Photo question]";
    db()
      .from("chat_messages")
      .insert([
        { session_id: sessionId, user_id: user.id, role: "user", content: loggedQuestion, tools_used: [] },
        { session_id: sessionId, user_id: user.id, role: "assistant", content: reply, tools_used: tools ?? [] },
      ])
      .then(({ error }) => error && logger.error({ err: error }, "chat log failed"));
  }

  return NextResponse.json({ reply, tools });
});
