import { NextResponse } from "next/server";
import { z } from "zod";
import { handler } from "@/lib/api";
import { HttpError, requireUser } from "@/lib/auth";
import { mlExtract } from "@/lib/ml";
import { rateLimit } from "@/lib/rate-limit";
import { db } from "@/lib/supabase";

export const maxDuration = 300;

const MAX_BYTES = 20 * 1024 * 1024;
const TYPES = ["application/pdf", "image/png", "image/jpeg", "image/webp", "image/heic"];
const MAX_TEXT = 400_000;

const metaSchema = z.object({
  title: z.string().trim().min(3).max(150),
  subject_title: z.string().trim().max(300).optional().nullable(),
  subject_code: z.string().trim().max(20).optional().nullable(),
  branch_code: z.enum(["CSE", "CSEAIML", "CSEDS", "IT", "ECE", "EE", "EEE", "ME", "CE"]).optional().nullable(),
  year: z.coerce.number().int().min(1).max(4).optional().nullable(),
  type: z.enum(["notes", "pyq", "imp_question", "other"]).default("notes"),
  drive_url: z.string().trim().url().optional().nullable(),
});

const LIST_COLUMNS =
  "id, title, subject_title, subject_code, branch_code, year, type, file_name, page_count, ocr_methods, ocr_confidence, quality, analysis, status, review_note, created_at";

/** GET /api/uploads: the student's own uploads (without the full text). */
export const GET = handler(async () => {
  const user = await requireUser();
  const { data, error } = await db().from("user_uploads").select(LIST_COLUMNS).eq("user_id", user.id).order("created_at", { ascending: false }).limit(50);
  if (error) throw error;
  return NextResponse.json({ uploads: data });
});

/**
 * POST /api/uploads (multipart): file + metadata.
 * The ML service reads the file (text layer or OCR) and checks photo quality.
 * Falls back to local PDF parsing or Gemini Vision when ML service is offline.
 * The upload is stored as pending until an admin approves it for indexing.
 */
export const POST = handler(async (request: Request) => {
  const user = await requireUser();
  rateLimit(`upload:${user.id}`, 6, 10 * 60_000);

  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) throw new HttpError(400, "Choose a PDF or photo to upload.");
  if (!TYPES.includes(file.type)) throw new HttpError(400, "Only PDF, PNG, JPG, WEBP or HEIC files are allowed.");
  if (file.size > MAX_BYTES) throw new HttpError(400, "File must be under 20 MB.");
  if (form.get("consent") !== "true") throw new HttpError(400, "Please confirm you have the right to share this material.");

  const meta = metaSchema.parse({
    title: form.get("title"),
    subject_title: form.get("subject_title") || null,
    subject_code: form.get("subject_code") || null,
    branch_code: form.get("branch_code") || null,
    year: form.get("year") || null,
    type: form.get("type") || "notes",
    drive_url: form.get("drive_url") || form.get("file_url") || null,
  });

  const result = await mlExtract(file);
  if (result.text.trim().length < 80) {
    throw new HttpError(422, "We could not read enough text from this file. Try a clearer photo or a text based PDF.");
  }

  const analysis = {
    ...result.analysis,
    ...(meta.drive_url ? { drive_url: meta.drive_url } : {}),
  };

  const { data, error } = await db()
    .from("user_uploads")
    .insert({
      user_id: user.id,
      title: meta.title,
      subject_title: meta.subject_title,
      subject_code: meta.subject_code || result.analysis.subject_codes[0] || null,
      branch_code: meta.branch_code,
      year: meta.year,
      type: meta.type,
      file_name: file.name.slice(0, 200),
      mime_type: file.type,
      size_bytes: file.size,
      page_count: result.page_count,
      ocr_methods: result.methods,
      ocr_confidence: result.ocr_confidence,
      quality: result.quality,
      analysis,
      text: result.text.slice(0, MAX_TEXT),
    })
    .select(LIST_COLUMNS)
    .single();
  if (error) throw error;

  return NextResponse.json({ upload: data, preview: result.text.slice(0, 1200), seconds: result.seconds });
});

/** DELETE /api/uploads?id= : a student can withdraw an upload that is still pending. */
export const DELETE = handler(async (request: Request) => {
  const user = await requireUser();
  const id = new URL(request.url).searchParams.get("id");
  if (!id) throw new HttpError(400, "id is required");
  const { error } = await db().from("user_uploads").delete().eq("id", id).eq("user_id", user.id).eq("status", "pending");
  if (error) throw error;
  return NextResponse.json({ ok: true });
});
