import { logger } from "faultkit";
import { createHash } from "node:crypto";
import { z } from "zod";
import { handler } from "@/lib/api";
import { HttpError, requireSession } from "@/lib/auth";
import { downloadPdf, getCircular } from "@/lib/circulars";
import { clientKey, rateLimit } from "@/lib/rate-limit";

/**
 * GET /api/circulars/[id]/pdf[?download=1]
 * Same-origin proxy for official AKTU circular PDFs so the browser PDF viewer can render
 * http:// and cookie-gated ERP attachments inside an iframe without mixed-content or frame blocks.
 */

const MAX_CACHED = 12;

type PdfEntry = { bytes: Uint8Array<ArrayBuffer>; etag: string };
const cache = new Map<string, PdfEntry>();
const inflight = new Map<string, Promise<PdfEntry>>();

type Ctx = { params: Promise<{ id: string }> };

async function getCachedPdf(id: string, url: string): Promise<PdfEntry> {
  const hit = cache.get(id);
  if (hit) {
    cache.delete(id);
    cache.set(id, hit);
    return hit;
  }
  const running = inflight.get(id);
  if (running) return running;

  const load = downloadPdf(url)
    .then((buf) => {
      const bytes = new Uint8Array(buf);
      const entry: PdfEntry = {
        bytes,
        etag: `"${createHash("sha1").update(bytes).digest("hex").slice(0, 20)}"`,
      };
      cache.set(id, entry);
      if (cache.size > MAX_CACHED) cache.delete(cache.keys().next().value!);
      return entry;
    })
    .finally(() => inflight.delete(id));

  inflight.set(id, load);
  return load;
}

export const GET = handler(async (request: Request, ctx: Ctx) => {
  const session = await requireSession();
  const id = z.string().regex(/^[\w-]{3,80}$/).parse((await ctx.params).id);
  rateLimit(`circular-pdf:${clientKey(request, session.id)}`, 30);

  const circular = await getCircular(id);
  if (!circular) throw new HttpError(404, "Circular not found.");

  let pdf: PdfEntry;
  try {
    pdf = await getCachedPdf(id, circular.pdf_url);
  } catch (err) {
    if (err instanceof HttpError && err.status === 422) throw err;
    logger.error({ err }, `circular pdf ${id} failed`);
    throw new HttpError(502, "Could not load the circular PDF right now. Please try again.");
  }

  const download = new URL(request.url).searchParams.get("download") === "1";
  const headers = {
    "Content-Type": "application/pdf",
    "Content-Disposition": `${download ? "attachment" : "inline"}; filename="aktu-circular-${id}.pdf"`,
    "Cache-Control": "private, max-age=86400",
    ETag: pdf.etag,
    "X-Content-Type-Options": "nosniff",
  };

  if (request.headers.get("if-none-match") === pdf.etag) return new Response(null, { status: 304, headers });
  return new Response(pdf.bytes, { headers: { ...headers, "Content-Length": String(pdf.bytes.length) } });
});
