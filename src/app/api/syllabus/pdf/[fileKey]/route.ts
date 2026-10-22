import { createHash } from "node:crypto";
import { handler } from "@/lib/api";
import { HttpError } from "@/lib/auth";
import { isDriveUrl, linksForFileKey, syllabusFileName } from "@/lib/syllabus";

/**
 * GET /api/syllabus/pdf/{fileKey}[?download=1&branch=CSE&year=2]
 * Same-origin proxy for official syllabus PDFs, so the browser PDF viewer can open them in an
 * iframe with #page=N. Only files listed in syllabus_links are served (no open proxy).
 */

const MAX_BYTES = 30 * 1024 * 1024;
const MAX_CACHED = 8;
const UA = { "User-Agent": "Mozilla/5.0" };

type PdfEntry = { bytes: Uint8Array<ArrayBuffer>; etag: string };
const cache = new Map<string, PdfEntry>();
const inflight = new Map<string, Promise<PdfEntry>>();

const isPdf = (b: Uint8Array) => b.length > 5 && String.fromCharCode(...b.subarray(0, 5)) === "%PDF-";

async function fetchBytes(url: string) {
  const res = await fetch(url, { headers: UA, redirect: "follow", signal: AbortSignal.timeout(60_000) });
  if (!res.ok) throw new Error(`PDF download failed (${res.status})`);
  const length = Number(res.headers.get("content-length") ?? 0);
  if (length > MAX_BYTES) throw new Error("PDF too large");
  return new Uint8Array(await res.arrayBuffer());
}

/** Downloads the PDF. Drive links become direct downloads, and the virus-scan confirm page is passed. */
async function download(url: string, fileKey: string): Promise<Uint8Array<ArrayBuffer>> {
  const drive = isDriveUrl(url);
  let bytes = await fetchBytes(drive ? `https://drive.google.com/uc?export=download&id=${encodeURIComponent(fileKey)}` : url);

  if (drive && !isPdf(bytes)) {
    const html = new TextDecoder().decode(bytes.subarray(0, 200_000));
    const confirm = html.match(/name="confirm" value="([^"]+)"/);
    const uuid = html.match(/name="uuid" value="([^"]+)"/);
    if (!confirm) throw new Error("Drive file is not public or not a PDF");
    const params = new URLSearchParams({ id: fileKey, export: "download", confirm: confirm[1] });
    if (uuid) params.set("uuid", uuid[1]);
    bytes = await fetchBytes(`https://drive.usercontent.google.com/download?${params}`);
  }
  if (bytes.length > MAX_BYTES) throw new Error("PDF too large");
  if (!isPdf(bytes)) throw new Error("Link did not return a PDF");
  return bytes;
}

async function getPdf(fileKey: string, url: string): Promise<PdfEntry> {
  const hit = cache.get(fileKey);
  if (hit) {
    // Refresh LRU position
    cache.delete(fileKey);
    cache.set(fileKey, hit);
    return hit;
  }
  const running = inflight.get(fileKey);
  if (running) return running;

  const load = download(url, fileKey)
    .then((bytes) => {
      const entry = { bytes, etag: `"${createHash("sha1").update(bytes).digest("hex").slice(0, 20)}"` };
      cache.set(fileKey, entry);
      if (cache.size > MAX_CACHED) cache.delete(cache.keys().next().value!);
      return entry;
    })
    .finally(() => inflight.delete(fileKey));
  inflight.set(fileKey, load);
  return load;
}

export const GET = handler(async (request: Request, { params }: { params: Promise<{ fileKey: string }> }) => {
  const { fileKey } = await params;
  if (!/^[\w-]{8,100}$/.test(fileKey)) throw new HttpError(404, "Syllabus PDF not found.");
  const links = await linksForFileKey(fileKey);
  if (!links.length) throw new HttpError(404, "Syllabus PDF not found.");

  let pdf: PdfEntry;
  try {
    pdf = await getPdf(fileKey, links[0].url);
  } catch (err) {
    console.error(`syllabus pdf ${fileKey} failed:`, err instanceof Error ? err.message : err);
    throw new HttpError(502, "Could not load the syllabus PDF right now. Please try again.");
  }

  const query = new URL(request.url).searchParams;
  const year = Number(query.get("year")) || null;
  const branch = query.get("branch")?.toUpperCase() ?? null;
  const fileName = syllabusFileName(branch, year);
  const headers = {
    "Content-Type": "application/pdf",
    "Content-Disposition": `${query.get("download") === "1" ? "attachment" : "inline"}; filename="${fileName}"`,
    "Cache-Control": "public, max-age=86400, s-maxage=604800, stale-while-revalidate=604800",
    ETag: pdf.etag,
    "X-Content-Type-Options": "nosniff",
  };

  if (request.headers.get("if-none-match") === pdf.etag) return new Response(null, { status: 304, headers });
  return new Response(pdf.bytes, { headers: { ...headers, "Content-Length": String(pdf.bytes.length) } });
});
