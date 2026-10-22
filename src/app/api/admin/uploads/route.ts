import { NextResponse } from "next/server";
import { z } from "zod";
import { clearCoverageCache } from "@/lib/ai/coverage";
import { handler } from "@/lib/api";
import { HttpError, requireAdmin } from "@/lib/auth";
import { mlIndex } from "@/lib/ml";
import { db } from "@/lib/supabase";

export const maxDuration = 300;

const TYPE_LABEL: Record<string, string> = { notes: "Notes", pyq: "PYQ", imp_question: "Important questions", other: "Material" };

/** GET /api/admin/uploads?status=pending : review queue with a text preview. */
export const GET = handler(async (request: Request) => {
  await requireAdmin();
  const status = new URL(request.url).searchParams.get("status") ?? "pending";
  const { data, error } = await db()
    .from("user_uploads")
    .select("id, title, subject_title, subject_code, branch_code, year, type, file_name, page_count, ocr_methods, ocr_confidence, quality, analysis, status, review_note, created_at, text, users!user_uploads_user_id_fkey(name, email)")
    .eq("status", status)
    .order("created_at", { ascending: status === "pending" })
    .limit(100);
  if (error) throw error;
  const uploads = (data ?? []).map(({ text, ...u }) => ({ ...u, preview: String(text).slice(0, 2500) }));
  return NextResponse.json({ uploads });
});

const reviewSchema = z.object({
  id: z.string().uuid(),
  action: z.enum(["approve", "reject"]),
  note: z.string().max(500).optional(),
});

/** POST /api/admin/uploads : approve (index into Pinecone through the ML service) or reject. */
export const POST = handler(async (request: Request) => {
  const admin = await requireAdmin();
  const { id, action, note } = reviewSchema.parse(await request.json());

  const { data: upload, error } = await db().from("user_uploads").select("*").eq("id", id).single();
  if (error || !upload) throw new HttpError(404, "Upload not found.");
  if (upload.status !== "pending") throw new HttpError(409, `Upload is already ${upload.status}.`);

  const reviewed = { reviewed_by: admin.id, reviewed_at: new Date().toISOString(), review_note: note ?? null };

  if (action === "reject") {
    await db().from("user_uploads").update({ ...reviewed, status: "rejected" }).eq("id", id);
    return NextResponse.json({ status: "rejected" });
  }

  const subject = upload.subject_title || upload.title;
  try {
    const indexed = await mlIndex({
      text: upload.text,
      title: `${subject} · ${TYPE_LABEL[upload.type] ?? "Material"} · ${upload.title} (student upload)`,
      subject_codes: upload.subject_code ? [upload.subject_code] : [],
      branch_codes: upload.branch_code ? [upload.branch_code] : [""],
      years: upload.year ? [upload.year] : [0],
      kind: "upload",
      uploaded_by: upload.user_id,
    });
    await db().from("user_uploads").update({ ...reviewed, status: "approved", document_id: indexed.document_id }).eq("id", id);
    clearCoverageCache();
    return NextResponse.json({ status: "approved", ...indexed });
  } catch (err) {
    await db().from("user_uploads").update({ ...reviewed, status: "failed", review_note: err instanceof Error ? err.message.slice(0, 400) : "Indexing failed" }).eq("id", id);
    throw err;
  }
});
