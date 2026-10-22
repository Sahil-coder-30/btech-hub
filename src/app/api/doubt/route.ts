import { NextResponse } from "next/server";
import { solveDoubt } from "@/lib/ai/generators";
import { handler } from "@/lib/api";
import { HttpError, requireSession } from "@/lib/auth";
import { clientKey, rateLimit } from "@/lib/rate-limit";
import { db } from "@/lib/supabase";

export const maxDuration = 60;

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp", "image/heic"];

/** POST /api/doubt (multipart): question text and/or a photo of the question. */
export const POST = handler(async (request: Request) => {
  const session = await requireSession();
  rateLimit(clientKey(request, session.id), 8);

  const form = await request.formData();
  const question = String(form.get("question") ?? "").slice(0, 2000).trim();
  const file = form.get("image");

  let image: { mimeType: string; base64: string } | undefined;
  if (file instanceof File && file.size > 0) {
    if (!IMAGE_TYPES.includes(file.type)) throw new HttpError(400, "Upload a PNG, JPG, WEBP or HEIC image.");
    if (file.size > MAX_IMAGE_BYTES) throw new HttpError(400, "Image must be under 5 MB.");
    image = { mimeType: file.type, base64: Buffer.from(await file.arrayBuffer()).toString("base64") };
  }
  if (!question && !image) throw new HttpError(400, "Type a question or upload a photo.");

  const answer = await solveDoubt(question, image);

  await db().from("doubts").insert({ user_id: session.id, question: question || null, answer, had_image: Boolean(image) });
  return NextResponse.json({ answer });
});
