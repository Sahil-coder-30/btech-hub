import { NextResponse } from "next/server";
import { clearChatHistory } from "@/lib/account";
import { handler } from "@/lib/api";
import { requireSession } from "@/lib/auth";

/** DELETE /api/account/chats: delete every saved Vac chat message. */
export const DELETE = handler(async () => {
  const session = await requireSession();
  return NextResponse.json({ ok: true, deleted: await clearChatHistory(session.id) });
});
