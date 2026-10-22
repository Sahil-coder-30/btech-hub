import { NextResponse } from "next/server";
import { handler } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/supabase";

const count = async (table: string, filter?: (q: any) => any) => {
  let query = db().from(table).select("*", { count: "exact", head: true });
  if (filter) query = filter(query);
  const { count: c } = await query;
  return c ?? 0;
};

/** GET /api/admin/stats: platform numbers and latest contact messages. */
export const GET = handler(async () => {
  await requireAdmin();
  const [users, chats, quizzes, plans, doubts, resources, missing, documents, visitors, messages] = await Promise.all([
    count("users"),
    count("chat_messages", (q) => q.eq("role", "user")),
    count("quiz_attempts"),
    count("study_plans"),
    count("doubts"),
    count("resources"),
    count("resources", (q) => q.is("url", null)),
    count("documents", (q) => q.eq("status", "indexed")),
    db().from("site_stats").select("value").eq("key", "visitors").maybeSingle(),
    db().from("contact_messages").select("*").order("created_at", { ascending: false }).limit(20),
  ]);

  return NextResponse.json({
    stats: { users, chats, quizzes, plans, doubts, resources, missing, documents, visitors: Number(visitors.data?.value ?? 0) },
    messages: messages.data ?? [],
  });
});
