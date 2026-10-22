import { after, NextResponse } from "next/server";
import { z } from "zod";
import { handler } from "@/lib/api";
import { HttpError, requireSession } from "@/lib/auth";
import { clientKey, rateLimit } from "@/lib/rate-limit";
import { assertIndexingConfigured, claimSyllabus, findSyllabusLink, getSyllabusInfo, ingestSyllabus } from "@/lib/syllabus";

// Ingestion runs in after() and needs the whole budget (download, OCR, embeddings)
export const maxDuration = 300;

const bodySchema = z.object({
  branch: z.string().trim().min(2).max(10).transform((b) => b.toUpperCase()),
  year: z.number().int().min(1).max(4),
});

/**
 * POST /api/syllabus/prepare { branch, year } -> SyllabusInfo
 * Starts one-time indexing of that syllabus PDF in the background. Idempotent: a ready or
 * already indexing PDF is left alone, and the lock is shared by every link to the same file.
 */
export const POST = handler(async (request: Request) => {
  const session = await requireSession();
  const { branch, year } = bodySchema.parse(await request.json());
  rateLimit(`prepare:${clientKey(request, session.id)}`, 5);

  const link = await findSyllabusLink(branch, year);
  if (!link) throw new HttpError(404, "There is no official syllabus PDF for this branch and year yet.");

  const current = await getSyllabusInfo(branch, year);
  if (current?.status !== "ready") {
    assertIndexingConfigured();
    if (await claimSyllabus(link)) {
      after(() => ingestSyllabus(link.fileKey).catch(() => undefined));
    }
  }

  const info = await getSyllabusInfo(branch, year);
  if (!info) throw new HttpError(404, "Unknown branch.");
  return NextResponse.json(info, { headers: { "Cache-Control": "private, no-store" } });
});
