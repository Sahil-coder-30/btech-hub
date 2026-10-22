import { NextResponse } from "next/server";
import { clearCoverageCache } from "@/lib/ai/coverage";
import { handler } from "@/lib/api";
import { HttpError, requireAdmin } from "@/lib/auth";
import { mlDelete, mlIngest } from "@/lib/ml";
import { db } from "@/lib/supabase";

export const maxDuration = 300;

const MAX_PDF_BYTES = 25 * 1024 * 1024;

/** GET /api/admin/documents: indexed RAG documents. */
export const GET = handler(async () => {
  await requireAdmin();
  const { data, error } = await db().from("documents").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return NextResponse.json({ documents: data });
});

/**
 * POST /api/admin/documents (multipart)
 * Fields: title, file (PDF) OR url, plus optional subject_code, branch_code, year.
 * The ML service does everything: download, text layer or OCR, chunking, embeddings, Pinecone.
 */
export const POST = handler(async (request: Request) => {
  const admin = await requireAdmin();
  const form = await request.formData();
  const title = String(form.get("title") ?? "").trim();
  const url = String(form.get("url") ?? "").trim();
  const file = form.get("file");
  if (!title) throw new HttpError(400, "Title is required.");

  const hasFile = file instanceof File && file.size > 0;
  if (hasFile) {
    if (file.type !== "application/pdf") throw new HttpError(400, "Only PDF files are supported.");
    if (file.size > MAX_PDF_BYTES) throw new HttpError(400, "PDF must be under 25 MB.");
  } else if (!url) {
    throw new HttpError(400, "Upload a PDF or paste a public PDF link.");
  }

  const subject = String(form.get("subject_code") ?? "").trim();
  const branch = String(form.get("branch_code") ?? "").trim();
  const year = Number(form.get("year")) || 0;

  const result = await mlIngest({
    title,
    file: hasFile ? file : null,
    url: hasFile ? null : url,
    sourceUrl: url || null,
    subjectCodes: subject ? [subject] : [],
    branchCodes: branch ? [branch] : [],
    years: year ? [year] : [],
    kind: "pdf",
    uploadedBy: admin.id,
  });
  clearCoverageCache();
  return NextResponse.json(result);
});

/** DELETE /api/admin/documents?id=: removes vectors from Pinecone and the row from Supabase. */
export const DELETE = handler(async (request: Request) => {
  await requireAdmin();
  const id = new URL(request.url).searchParams.get("id");
  if (!id) throw new HttpError(400, "id is required");
  await mlDelete(id);
  clearCoverageCache();
  return NextResponse.json({ ok: true });
});
