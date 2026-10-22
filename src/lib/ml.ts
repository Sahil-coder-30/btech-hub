import { HttpError } from "./auth";

/** Client for the separately deployed FastAPI ML service (OCR, vision, indexing). */

export type ExtractResult = {
  filename: string;
  kind: "pdf" | "image";
  page_count: number;
  methods: { text_layer: number; ocr: number; vision: number };
  ocr_confidence: number | null;
  quality: { ok: boolean; issues: string[]; sharpness: number; brightness: number; width: number; height: number } | null;
  analysis: { language: string; suggested_type: string; subject_codes: string[]; keywords: string[]; characters: number; words: number };
  text: string;
  seconds: number;
};

export function isMlConfigured() {
  const token = process.env.ML_SERVICE_TOKEN;
  return Boolean(process.env.ML_SERVICE_URL && token && !token.startsWith("generate-"));
}

function config() {
  const url = process.env.ML_SERVICE_URL?.replace(/\/$/, "");
  const token = process.env.ML_SERVICE_TOKEN;
  if (!url || !token || !isMlConfigured()) {
    throw new HttpError(503, "Upload processing is not configured. Set ML_SERVICE_URL and ML_SERVICE_TOKEN.");
  }
  return { url, token };
}

async function call<T>(path: string, init: RequestInit, timeoutMs: number): Promise<T> {
  const { url, token } = config();
  let res: Response;
  try {
    res = await fetch(`${url}${path}`, {
      ...init,
      headers: { ...(init.headers ?? {}), Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (err) {
    const timedOut = err instanceof Error && err.name === "TimeoutError";
    throw new HttpError(timedOut ? 504 : 502, timedOut ? "Processing took too long. Try a smaller file." : "ML service is not reachable right now.");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new HttpError(res.status === 422 ? 422 : 502, (data as { detail?: string }).detail ?? "ML service error.");
  return data as T;
}

/** Sends a PDF or image for text extraction (text layer, local OCR, optional vision fallback). */
export function mlExtract(file: File, vision = false) {
  const form = new FormData();
  form.set("file", file, file.name);
  form.set("vision", String(vision));
  return call<ExtractResult>("/v1/extract", { method: "POST", body: form }, 280_000);
}

export function mlIndex(body: {
  text: string;
  title: string;
  source_url?: string | null;
  subject_codes?: string[];
  branch_codes?: string[];
  years?: number[];
  kind?: string;
  uploaded_by?: string | null;
}) {
  return call<{ document_id: string; chunks: number }>(
    "/v1/index",
    { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) },
    280_000,
  );
}

export type IngestResult = {
  document_id: string;
  chunks: number;
  page_count: number;
  methods: { text_layer: number; ocr: number; vision: number };
  ocr_confidence: number | null;
};

/**
 * The one ingestion pipeline: the ML service extracts text (OCR for scans), chunks, embeds,
 * stores vectors in Pinecone and records the document in Supabase.
 */
export function mlIngest(input: {
  title: string;
  file?: File | null;
  url?: string | null;
  sourceUrl?: string | null;
  subjectCodes?: string[];
  branchCodes?: string[];
  years?: number[];
  kind?: string;
  uploadedBy?: string | null;
}) {
  const form = new FormData();
  form.set("title", input.title);
  if (input.file) form.set("file", input.file, input.file.name);
  if (input.url) form.set("url", input.url);
  if (input.sourceUrl) form.set("source_url", input.sourceUrl);
  if (input.subjectCodes?.length) form.set("subject_codes", input.subjectCodes.join(","));
  if (input.branchCodes?.length) form.set("branch_codes", input.branchCodes.join(","));
  if (input.years?.length) form.set("years", input.years.join(","));
  form.set("kind", input.kind ?? "pdf");
  if (input.uploadedBy) form.set("uploaded_by", input.uploadedBy);
  return call<IngestResult>("/v1/ingest", { method: "POST", body: form }, 290_000);
}

/** Removes a document's vectors from Pinecone and its row from Supabase. */
export function mlDelete(documentId: string) {
  return call<{ ok: boolean }>(`/v1/index/${encodeURIComponent(documentId)}`, { method: "DELETE" }, 60_000);
}

/** Plain text of a PDF, read by the ML service (text layer, or OCR for scanned pages). */
export async function pdfToText(buffer: ArrayBuffer, filename = "document.pdf"): Promise<string> {
  const result = await mlExtract(new File([buffer], filename, { type: "application/pdf" }));
  return result.text;
}
