import { NextResponse } from "next/server";
import { z } from "zod";
import { handler } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { clearMemories, listMemories, MEMORY_KINDS, MEMORY_LIMIT, saveMemory } from "@/lib/profile";
import { clientKey, rateLimit } from "@/lib/rate-limit";

const createSchema = z.object({
  kind: z.enum(MEMORY_KINDS),
  content: z.string().trim().min(3).max(300),
});

/** GET /api/memory: everything Vac remembers about the logged-in student, pinned first. */
export const GET = handler(async () => {
  const user = await requireUser();
  return NextResponse.json({ memories: await listMemories(user.id), limit: MEMORY_LIMIT });
});

/** POST /api/memory: the student adds a memory themselves. */
export const POST = handler(async (request: Request) => {
  const user = await requireUser();
  rateLimit(`memory:${clientKey(request, user.id)}`, 30);
  const body = createSchema.parse(await request.json());
  const { memory, status } = await saveMemory(user.id, { ...body, source: "manual" });
  // A new memory never replaces one here, so status is "saved" or "duplicate"
  return NextResponse.json({ memory, status: status === "duplicate" ? "duplicate" : "saved" });
});

/** DELETE /api/memory: forget everything, or only the unpinned memories with ?keepPinned=1. */
export const DELETE = handler(async (request: Request) => {
  const user = await requireUser();
  const flag = new URL(request.url).searchParams.get("keepPinned");
  const deleted = await clearMemories(user.id, { keepPinned: flag === "1" || flag === "true" });
  return NextResponse.json({ ok: true, deleted });
});
