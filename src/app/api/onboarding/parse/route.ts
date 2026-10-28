import { NextResponse } from "next/server";
import { parseResultWithGemini } from "@/lib/ai/generators";
import { enrichResult, parseAktuResult } from "@/lib/aktu-result";
import { handler } from "@/lib/api";
import { HttpError, requireUser } from "@/lib/auth";
import { getAllSubjects } from "@/lib/data";
import { pdfToText } from "@/lib/ml";
import { clientKey, rateLimit } from "@/lib/rate-limit";

export const maxDuration = 60;

const MAX_PDF_BYTES = 5 * 1024 * 1024;

/**
 * POST /api/onboarding/parse (multipart, field "file")
 * Reads an AKTU One View result PDF and returns every semester for the student
 * to review. The PDF is processed in memory and never stored.
 */
export const POST = handler(async (request: Request) => {
  const user = await requireUser();
  rateLimit(`parse:${clientKey(request, user.id)}`, 5);

  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) throw new HttpError(400, "Upload your AKTU result PDF.");
  if (file.type !== "application/pdf") throw new HttpError(400, "Only PDF files are supported.");
  if (file.size > MAX_PDF_BYTES) throw new HttpError(400, "PDF must be under 5 MB.");

  const buffer = await file.arrayBuffer();
  const base64 = Buffer.from(buffer).toString("base64");
  // The ML service reads the text layer. If it is down, Gemini still reads the PDF below.
  const text = await pdfToText(buffer, "result.pdf").catch((err) => {
    console.error("result text extraction failed:", err instanceof Error ? err.message : err);
    return "";
  });

  let parsed = parseAktuResult(text);
  let via: "text" | "ai" = "text";
  if (!parsed.semesters.length) {
    // Scanned PDFs or a changed layout: let Gemini read the document
    parsed = await parseResultWithGemini(base64).catch((err) => {
      console.error("AI result parsing failed:", err instanceof Error ? err.message.slice(0, 200) : err);
      throw new HttpError(503, "We could not read this PDF right now. Try again in a few minutes, or continue without your result.");
    });
    via = "ai";
  }

  if (!parsed.semesters.length) {
    throw new HttpError(422, "We could not find any semester in this PDF. Upload the One View result from the AKTU ERP portal.");
  }
  if (parsed.course && !/B\.?\s*TECH/i.test(parsed.course)) {
    throw new HttpError(422, "Only B.Tech results are supported right now.");
  }

  const result = enrichResult(parsed, await getAllSubjects());
  return NextResponse.json({ result, via });
});
