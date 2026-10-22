import { NextResponse } from "next/server";
import { z } from "zod";
import { handler } from "@/lib/api";
import { HttpError, requireAdmin } from "@/lib/auth";
import { allSyllabusLinks, assertIndexingConfigured, claimSyllabus, ingestSyllabus } from "@/lib/syllabus";

export const maxDuration = 300;

/**
 * POST /api/admin/syllabus-index { id }
 * Re-indexes one official syllabus PDF (and every link sharing that file) through the same
 * page-aware pipeline as Ask your Syllabus, inline, so the admin sees the result.
 */
export const POST = handler(async (request: Request) => {
  const admin = await requireAdmin();
  const { id } = z.object({ id: z.number().int().positive() }).parse(await request.json());

  const link = (await allSyllabusLinks()).find((l) => l.id === id);
  if (!link) throw new HttpError(404, "Syllabus link not found.");

  assertIndexingConfigured();
  if (!(await claimSyllabus(link, true))) throw new HttpError(409, "This syllabus PDF is already being indexed. Try again in a few minutes.");

  const result = await ingestSyllabus(link.fileKey, admin.id);
  return NextResponse.json(result);
});
