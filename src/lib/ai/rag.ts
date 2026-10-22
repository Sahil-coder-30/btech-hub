import { Pinecone } from "@pinecone-database/pinecone";
import { embeddingProvider, isPineconeConfigured, pineconeNamespace, requireEnv } from "../env";
import type { Source } from "../types";
import { z } from "zod";
import { getCoverage, rejectionMessage, unindexedCodes } from "./coverage";
import { chatModel, embedder } from "./model";

/**
 * Retrieval Augmented Generation over syllabus PDFs and notes.
 * Vectors live in Pinecone, document metadata lives in Supabase (documents table).
 */

export type ChunkMetadata = {
  docId: string;
  title: string;
  sourceUrl: string;
  subjectCode: string | string[];
  branchCode: string | string[];
  year: number;
  chunk: number;
  text: string;
  /** Page aware documents only: 1-based first and last PDF page of the chunk, nearest subject heading */
  page?: number;
  pageEnd?: number;
  section?: string;
};

let pinecone: Pinecone | null = null;

/** Pinecone namespace that holds every study material chunk. */
export function pineconeIndex() {
  if (!pinecone) pinecone = new Pinecone({ apiKey: requireEnv("PINECONE_API_KEY") });
  return pinecone.index<ChunkMetadata>(requireEnv("PINECONE_INDEX")).namespace(pineconeNamespace());
}

// Ingestion (text extraction, OCR, chunking, embeddings, upsert) lives in the ML service.
// See src/lib/ml.ts (mlIngest, mlDelete, pdfToText) and ml-service/.

// ---------- Retrieval ----------

/**
 * Minimum cosine score for a chunk to count as relevant. Mistral scores everything higher:
 * measured on our data, real matches score 0.74 to 0.84 and unrelated questions 0.63 to 0.69.
 */
export const MIN_SCORE = { mistral: 0.7, gemini: 0.35 } as const;

export type RetrieveFilter = { branchCode?: string | null; year?: number | null; subjectCode?: string | null };

export async function retrieve(query: string, filter: RetrieveFilter = {}, topK = 6): Promise<Source[]> {
  if (!isPineconeConfigured()) return [];
  const vector = await embedder().embedQuery(query);

  // Common first-year material has no branch, so allow it alongside the chosen branch.
  const conditions: Record<string, unknown>[] = [];
  if (filter.branchCode) conditions.push({ branchCode: { $in: [filter.branchCode, ""] } });
  if (filter.year) conditions.push({ year: { $in: [filter.year, 0] } });
  if (filter.subjectCode) conditions.push({ subjectCode: { $eq: filter.subjectCode } });

  const result = await pineconeIndex().query({
    vector,
    topK,
    includeMetadata: true,
    ...(conditions.length ? { filter: { $and: conditions } } : {}),
  });

  return (result.matches ?? [])
    .filter((m) => m.metadata && (m.score ?? 0) >= MIN_SCORE[embeddingProvider()])
    .map((m, i) => ({
      index: i + 1,
      title: m.metadata!.title,
      url: m.metadata!.sourceUrl || null,
      snippet: m.metadata!.text,
      score: Math.round((m.score ?? 0) * 100) / 100,
      page: m.metadata!.page ?? null,
      pageEnd: m.metadata!.pageEnd ?? null,
    }));
}

const answerSchema = z.object({
  covered: z
    .boolean()
    .describe("false if the question is about a subject or topic that the CONTEXT does not cover at all, true otherwise"),
  answer: z.string().describe("Markdown answer with [n] citations, or one short line on what is missing when covered is false"),
});

/**
 * Answers a question using only retrieved context, with [n] citations.
 * Questions about material that is not indexed are rejected before or by the single answer call.
 */
export async function answerWithSources(question: string, filter: RetrieveFilter = {}) {
  const coverage = await getCoverage();

  const missing = unindexedCodes(question, coverage);
  if (missing.length) {
    return { answer: rejectionMessage(coverage, `Subject ${missing.join(", ")} has no indexed notes, PYQs or syllabus.`), sources: [], rejected: true };
  }

  const sources = await retrieve(question, filter);
  if (!sources.length) {
    return { answer: rejectionMessage(coverage, "Nothing in the indexed material matches this question."), sources, rejected: true };
  }

  const context = sources.map((s) => `[${s.index}] (${s.title})\n${s.snippet}`).join("\n\n---\n\n");
  const result = await chatModel(0.2)
    .withStructuredOutput(answerSchema, { name: "grounded_answer" })
    .invoke([
      {
        role: "system",
        content:
          "You are a study assistant for AKTU B.Tech students. Answer ONLY from the CONTEXT below. " +
          "First decide `covered`: if the question asks about a subject or topic that none of the context passages are about " +
          "(for example the student asks about Chemistry but the context is Physics notes), set covered=false and do not answer. " +
          "Otherwise set covered=true and answer. Cite sources inline like [1] or [2][3]. If only part is covered, answer that part and say what is missing. " +
          "Use short paragraphs, bullet points and markdown. Use LaTeX ($...$) for formulas.\n\nCONTEXT:\n" +
          context,
      },
      { role: "user", content: question },
    ]);

  if (!result.covered) {
    return { answer: rejectionMessage(coverage, result.answer || "The indexed material does not cover this question."), sources: [], rejected: true };
  }
  return { answer: result.answer, sources, rejected: false };
}
