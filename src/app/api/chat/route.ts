import { NextResponse } from "next/server";
import { z } from "zod";
import { runVacAgent } from "@/lib/ai/agent";
import { handler } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { buildStudentContext } from "@/lib/profile";
import { clientKey, rateLimit } from "@/lib/rate-limit";
import { readPreferences } from "@/lib/settings";
import { db } from "@/lib/supabase";

export const maxDuration = 60;

const bodySchema = z.object({
  sessionId: z.string().min(8).max(64),
  messages: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().min(1).max(4000) }))
    .min(1)
    .max(30),
});

/** POST /api/chat: one turn of the Vac LangChain agent. */
export const POST = handler(async (request: Request) => {
  // Vac is a logged-in feature, like every AI tool on the site
  const user = await requireUser();
  const { sessionId, messages } = bodySchema.parse(await request.json());
  rateLimit(`chat:${clientKey(request, user.id)}`, 20);

  // Only the last few turns are sent to keep the prompt small
  const history = messages.slice(-12);
  if (history[0]?.role === "assistant") history.shift();

  // The user row is already loaded, so this costs no query
  const prefs = readPreferences(user);

  // Profile and memory are a bonus, a DB hiccup should not break the chat.
  // With "Use my profile" off the context is skipped entirely (no queries).
  const context = prefs.vac.useProfile ? await buildStudentContext(user).catch(() => null) : null;
  const { reply, tools } = await runVacAgent(history, user, context, prefs.vac);

  // Logging is best effort, and only for students who keep chat history
  if (prefs.privacy.saveChatHistory) {
    const userMessage = history[history.length - 1];
    db()
      .from("chat_messages")
      .insert([
        { session_id: sessionId, user_id: user.id, role: "user", content: userMessage.content, tools_used: [] },
        { session_id: sessionId, user_id: user.id, role: "assistant", content: reply, tools_used: tools ?? [] },
      ])
      .then(({ error }) => error && console.error("chat log failed:", error.message));
  }

  return NextResponse.json({ reply, tools });
});
