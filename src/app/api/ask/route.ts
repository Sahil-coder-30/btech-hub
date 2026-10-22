import { NextResponse } from "next/server";
import { z } from "zod";
import { askSyllabusStream } from "@/lib/ai/syllabus-chat";
import { handler } from "@/lib/api";
import { HttpError, requireSession } from "@/lib/auth";
import { isPineconeConfigured } from "@/lib/env";
import { clientKey, rateLimit } from "@/lib/rate-limit";
import { findSyllabusLink, getSyllabusInfo, readySyllabusDocument } from "@/lib/syllabus";

export const maxDuration = 60;

const bodySchema = z.object({
  branch: z.string().trim().min(2).max(10).transform((b) => b.toUpperCase()),
  year: z.number().int().min(1).max(4),
  question: z.string().trim().min(2).max(1000),
  history: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(4000) }))
    .max(12)
    .default([])
    .transform((turns) => turns.filter((t) => t.content.trim())),
});

/**
 * POST /api/ask: chat with one official syllabus PDF.
 * Errors before the answer starts are JSON ({ error }). The answer itself streams as NDJSON
 * AskStreamEvent lines: meta, delta..., done (or error).
 */
export const POST = handler(async (request: Request) => {
  const session = await requireSession();
  const body = bodySchema.parse(await request.json().catch(() => ({})));
  rateLimit(`ask:${clientKey(request, session.id)}`, 20);

  if (!isPineconeConfigured()) {
    return NextResponse.json({ error: "Pinecone is not configured yet. Add PINECONE_API_KEY in .env.local." }, { status: 503 });
  }

  const [link, info] = await Promise.all([findSyllabusLink(body.branch, body.year), getSyllabusInfo(body.branch, body.year)]);
  if (!info) throw new HttpError(404, "Unknown branch.");
  if (!link) throw new HttpError(404, "There is no official syllabus PDF for this branch and year yet.");

  const { documentId, status } = await readySyllabusDocument(link);
  if (!documentId) {
    return NextResponse.json({ error: "This syllabus is not ready for questions yet.", status }, { status: 409 });
  }

  const stream = askSyllabusStream({
    documentId,
    fileKey: link.fileKey,
    branch: body.branch,
    branchName: info.branchName,
    year: body.year,
    question: body.question,
    history: body.history,
    userId: session.id,
    signal: request.signal,
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Accel-Buffering": "no",
    },
  });
});
