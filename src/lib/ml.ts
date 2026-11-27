import { logger } from "faultkit";
import { isPineconeConfigured } from "./env";
import { mlExtract, type ExtractResult } from "./ml-extract";

export { mlExtract, type ExtractResult };

/** Client for the separately deployed FastAPI ML service (OCR, vision, indexing). */
export function isMlConfigured() {
  return true;
}

export async function mlIndex(body: {
  text: string;
  title: string;
  source_url?: string | null;
  subject_codes?: string[];
  branch_codes?: string[];
  years?: number[];
  kind?: string;
  uploaded_by?: string | null;
}): Promise<{ document_id: string; chunks: number }> {
  const docId = crypto.randomUUID();
  const rawChunks: string[] = [];
  const chunkSize = 1000;
  const overlap = 150;
  let start = 0;
  while (start < body.text.length) {
    const end = Math.min(start + chunkSize, body.text.length);
    rawChunks.push(body.text.slice(start, end).trim());
    if (end >= body.text.length) break;
    start = end - overlap;
  }
  const chunks = rawChunks.filter((c) => c.length > 50);

  if (isPineconeConfigured()) {
    try {
      const { embedder } = await import("./ai/model");
      const { pineconeIndex } = await import("./ai/rag");
      // One batched call: one request per chunk hits the provider's rate limit on big files
      const embeddings = await embedder().embedDocuments(chunks);
      const vectors = chunks.map((chunkText, i) => ({
        id: `${docId}_${i}`,
        values: embeddings[i],
        metadata: {
          docId,
          title: body.title,
          sourceUrl: body.source_url || "",
          subjectCode: body.subject_codes || [],
          branchCode: body.branch_codes || [],
          year: body.years?.[0] || 0,
          chunk: i,
          text: chunkText,
        },
      }));
      await pineconeIndex().upsert(vectors.filter((v) => v.values.length));
    } catch (err) {
      logger.warn({ err }, "[mlIndex] Vector indexing warning");
    }
  }

  try {
    const { db } = await import("./supabase");
    await db().from("documents").insert({
      id: docId,
      title: body.title,
      source_url: body.source_url || null,
      subject_code: body.subject_codes?.[0] || null,
      branch_code: body.branch_codes?.[0] || null,
      year: body.years?.[0] || null,
      chunk_count: chunks.length,
      status: "indexed",
      uploaded_by: body.uploaded_by || null,
      kind: body.kind || "upload",
    });
  } catch (err) {
    logger.warn({ err }, "[mlIndex] Document record warning");
  }

  return { document_id: docId, chunks: chunks.length };
}

export type IngestResult = {
  document_id: string;
  chunks: number;
  page_count: number;
  methods: { text_layer: number; ocr: number; vision: number };
  ocr_confidence: number | null;
};

/**
 * Serverless ingestion pipeline: extracts text with local parser and Gemini vision,
 * chunks, embeds into Pinecone, and records the document in Supabase.
 */
export async function mlIngest(input: {
  title: string;
  file?: File | null;
  url?: string | null;
  sourceUrl?: string | null;
  subjectCodes?: string[];
  branchCodes?: string[];
  years?: number[];
  kind?: string;
  uploadedBy?: string | null;
}): Promise<IngestResult> {
  let fileToExtract = input.file;
  if (!fileToExtract && input.url) {
    try {
      const res = await fetch(input.url, { signal: AbortSignal.timeout(30_000) });
      const blob = await res.blob();
      fileToExtract = new File([blob], "document.pdf", { type: blob.type || "application/pdf" });
    } catch (err) {
      logger.warn({ err }, "[mlIngest] Failed to download remote document URL");
    }
  }

  let text = input.title;
  let pageCount = 1;
  let methods = { text_layer: 0, ocr: 0, vision: 0 };
  let ocrConfidence: number | null = null;

  if (fileToExtract) {
    const extracted = await mlExtract(fileToExtract);
    text = extracted.text;
    pageCount = extracted.page_count;
    methods = extracted.methods;
    ocrConfidence = extracted.ocr_confidence;
  }

  const indexRes = await mlIndex({
    text,
    title: input.title,
    source_url: input.sourceUrl || input.url || null,
    subject_codes: input.subjectCodes,
    branch_codes: input.branchCodes,
    years: input.years,
    kind: input.kind,
    uploaded_by: input.uploadedBy,
  });

  return {
    document_id: indexRes.document_id,
    chunks: indexRes.chunks,
    page_count: pageCount,
    methods,
    ocr_confidence: ocrConfidence,
  };
}

/** Removes a document's vectors from Pinecone and its row from Supabase. */
export async function mlDelete(documentId: string): Promise<{ ok: boolean }> {
  if (isPineconeConfigured()) {
    try {
      const { pineconeIndex } = await import("./ai/rag");
      await pineconeIndex().deleteMany({ filter: { docId: { $eq: documentId } } });
    } catch (err) {
      logger.warn({ err }, "[mlDelete] Pinecone delete warning");
    }
  }
  try {
    const { db } = await import("./supabase");
    await db().from("documents").delete().eq("id", documentId);
  } catch (err) {
    logger.warn({ err }, "[mlDelete] Supabase delete warning");
  }
  return { ok: true };
}

/** Plain text of a PDF, read by the ML service (text layer, or OCR for scanned pages). */
export async function pdfToText(buffer: ArrayBuffer, filename = "document.pdf"): Promise<string> {
  const result = await mlExtract(new File([buffer], filename, { type: "application/pdf" }));
  return result.text;
}
