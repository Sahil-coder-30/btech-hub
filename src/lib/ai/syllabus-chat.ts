import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { HttpError } from "../auth";
import { agentProvider, embeddingProvider, geminiModel, isPineconeConfigured, requireEnv } from "../env";
import { db } from "../supabase";
import { getSyllabusSemesters } from "../syllabus";
import type { AskStreamEvent, ChatRole, Source, SyllabusInfo } from "../types";
import { agentModel, contentToText, embedder } from "./model";
import { MIN_SCORE, pineconeIndex } from "./rag";

/**
 * Chat over one official syllabus PDF: condense the follow-up, hybrid retrieval
 * (Pinecone vectors + Postgres full text, merged with Reciprocal Rank Fusion), then a
 * streamed, cited answer from Gemini with a Mistral fallback.
 */

export type AskTurn = { role: ChatRole; content: string };

export type AskInput = {
  documentId: string;
  fileKey: string;
  branch: string;
  branchName: string;
  year: number;
  question: string;
  history: AskTurn[];
  userId: string;
  signal?: AbortSignal;
};

// ---------- Small LRU with TTL ----------

class Lru<V> {
  private map = new Map<string, { at: number; value: V }>();
  private max: number;
  private ttlMs: number;
  constructor(max: number, ttlMs = Infinity) {
    this.max = max;
    this.ttlMs = ttlMs;
  }
  get(key: string): V | undefined {
    const hit = this.map.get(key);
    if (!hit) return undefined;
    this.map.delete(key);
    if (Date.now() - hit.at > this.ttlMs) return undefined;
    this.map.set(key, hit);
    return hit.value;
  }
  set(key: string, value: V) {
    this.map.delete(key);
    this.map.set(key, { at: Date.now(), value });
    if (this.map.size > this.max) this.map.delete(this.map.keys().next().value!);
  }
}

type CachedAnswer = { answer: string; sources: Source[]; query: string; grounded: boolean };
const answerCache = new Lru<CachedAnswer>(300, 6 * 60 * 60_000);
const embeddingCache = new Lru<number[]>(500);

export function normalizeQuestion(q: string) {
  return q.toLowerCase().replace(/\s+/g, " ").trim().replace(/[?!.\s]+$/, "");
}

// ---------- 1. Condense follow-ups ----------

const stripCitations = (text: string) => text.replace(/\s?(\[\d{1,2}\])+/g, "");

async function condenseQuestion(question: string, history: AskTurn[], signal: AbortSignal): Promise<string> {
  const lastUser = [...history].reverse().find((t) => t.role === "user")?.content ?? "";
  const fallback = `${lastUser.slice(0, 300)} ${question}`.trim();
  const transcript = history
    .slice(-6)
    .map((t) => `${t.role === "user" ? "Student" : "Assistant"}: ${stripCitations(t.content).slice(0, 600)}`)
    .join("\n");
  try {
    const result = await agentModel(0).invoke(
      [
        {
          role: "system",
          content:
            "Rewrite the student's latest question as ONE standalone search query for their AKTU syllabus PDF. " +
            "Resolve words like it, this, that unit, same subject using the conversation. Keep subject names, codes and unit numbers. " +
            "Never add a subject code, name or topic that is not in the conversation. " +
            "Output only the query, no quotes, at most 25 words.",
        },
        { role: "user", content: `Conversation:\n${transcript}\n\nLatest question: ${question}` },
      ],
      { signal: AbortSignal.any([signal, AbortSignal.timeout(2500)]) },
    );
    const query = contentToText(result.content).replace(/^["'\s]+|["'\s]+$/g, "").split("\n")[0].trim();
    return query.length >= 2 && query.length <= 300 ? query : fallback;
  } catch {
    return fallback;
  }
}

// ---------- 2. Hybrid retrieval ----------

type Candidate = { key: string; title: string; text: string; page: number | null; pageEnd: number | null; score: number };

const STOPWORDS = new Set(
  "the a an and or of in on to for is are was were be what whats which who how why when where does do did this that these those it its with from by about tell me give explain list all any there their my our your please can you i".split(" "),
);
/** Words that appear on nearly every syllabus page, so a keyword hit on them alone proves nothing. */
const GENERIC = new Set("unit units syllabus subject subjects semester sem course courses credit credits topic topics paper marks year lab labs".split(" "));

function queryTerms(query: string) {
  const words = query.toLowerCase().match(/[a-z0-9+#]+/g) ?? [];
  return [...new Set(words.filter((w) => w.length >= 3 && !STOPWORDS.has(w)))];
}

/** Prefix match so "structures" finds "structure" and "scheduling" finds "schedule". */
function termIndex(haystack: string, term: string) {
  const stem = term.length > 5 ? term.slice(0, Math.max(5, term.length - 3)) : term;
  return haystack.indexOf(stem);
}

/** ~900 characters around the first matched query term. */
function windowAround(text: string, terms: string[], size = 900) {
  const lower = text.toLowerCase();
  const positions = terms.map((t) => termIndex(lower, t)).filter((i) => i >= 0);
  const first = positions.length ? Math.min(...positions) : 0;
  let start = Math.max(0, first - 250);
  if (start > 0) {
    const space = text.lastIndexOf(" ", start);
    start = space > start - 40 ? space + 1 : start;
  }
  let end = Math.min(text.length, start + size);
  if (end < text.length) {
    const space = text.indexOf(" ", end);
    end = space > 0 && space < end + 40 ? space : end;
  }
  return text.slice(start, end).trim();
}

async function embedQuery(query: string) {
  const key = `${embeddingProvider()}:${query.trim().toLowerCase()}`;
  const hit = embeddingCache.get(key);
  if (hit) return hit;
  const vector = await embedder().embedQuery(query);
  embeddingCache.set(key, vector);
  return vector;
}

async function vectorSearch(documentId: string, query: string, title: string): Promise<Candidate[]> {
  if (!isPineconeConfigured()) return [];
  const vector = await embedQuery(query);
  const result = await pineconeIndex().query({ vector, topK: 10, includeMetadata: true, filter: { docId: { $eq: documentId } } });
  // Mistral gives unrelated text about 0.63 to 0.69, so only junk is dropped here. RRF does the ranking.
  const floor = embeddingProvider() === "mistral" ? 0.5 : 0.2;
  return (result.matches ?? [])
    .filter((m) => m.metadata?.text && (m.score ?? 0) >= floor)
    .map((m) => ({
      key: `v:${m.id}`,
      // Nearest subject heading (page aware index) tells the student more than the file title
      title: m.metadata!.section || title,
      text: m.metadata!.text,
      page: m.metadata!.page ?? null,
      pageEnd: m.metadata!.pageEnd ?? m.metadata!.page ?? null,
      score: m.score ?? 0,
    }));
}

let keywordWarned = false;

async function keywordSearch(documentId: string, query: string, title: string): Promise<{ hits: Candidate[]; specific: boolean }> {
  const terms = queryTerms(query);
  if (!terms.length) return { hits: [], specific: false };
  const { data, error } = await db().rpc("search_document_pages", { doc: documentId, q: query, k: 4 });
  if (error) {
    // Keyword search is a bonus: the migration may be missing, vectors still work
    if (!keywordWarned) console.warn("search_document_pages failed:", error.message);
    keywordWarned = true;
    return { hits: [], specific: false };
  }
  const rows = (data ?? []) as { page: number; text: string; rank: number }[];
  const specificTerms = terms.filter((t) => !GENERIC.has(t));
  const specific = rows.some((r) => specificTerms.some((t) => termIndex(r.text.toLowerCase(), t) >= 0));
  return {
    hits: rows.map((r) => ({ key: `k:${r.page}`, title, text: windowAround(r.text, specificTerms.length ? specificTerms : terms), page: r.page, pageEnd: r.page, score: r.rank })),
    specific,
  };
}

const RRF_K = 60;
const MAX_SOURCES = 6;

/** contexts[i] is the full text of sources[i] for the prompt (keeps the "[section]" chunk header). */
export type Retrieval = { sources: Source[]; contexts: string[]; confident: boolean };

/** Page aware chunks start with "[<section>]\n". Useful for the model, noise in the UI snippet. */
const stripSectionHeader = (text: string) => text.replace(/^\[[^\]\n]{1,160}\]\n/, "");

/** Vector + keyword search in parallel, fused with Reciprocal Rank Fusion, numbered 1..n. */
export async function retrieveSyllabus(documentId: string, query: string, title: string): Promise<Retrieval> {
  const [vectors, keywords] = await Promise.all([
    vectorSearch(documentId, query, title),
    keywordSearch(documentId, query, title).catch(() => ({ hits: [] as Candidate[], specific: false })),
  ]);
  const terms = queryTerms(query);

  const fused = new Map<string, { candidate: Candidate; rrf: number }>();
  vectors.forEach((c, i) => fused.set(c.key, { candidate: c, rrf: 1 / (RRF_K + i + 1) }));
  keywords.hits.forEach((c, i) => {
    const score = 1 / (RRF_K + i + 1);
    // Same page already found by vectors and that chunk holds a query word: boost it instead of adding a duplicate
    const overlap = vectors.find(
      (v) => v.page != null && c.page! >= v.page && c.page! <= (v.pageEnd ?? v.page) && terms.some((t) => termIndex(v.text.toLowerCase(), t) >= 0),
    );
    if (overlap) fused.get(overlap.key)!.rrf += score;
    else fused.set(c.key, { candidate: c, rrf: score });
  });

  const ranked = [...fused.values()].sort((a, b) => b.rrf - a.rrf).slice(0, MAX_SOURCES);
  const bestVector = Math.max(0, ...vectors.map((v) => v.score));
  const confident = bestVector >= MIN_SCORE[embeddingProvider()] || keywords.specific;

  return {
    confident,
    contexts: ranked.map(({ candidate: c }) => c.text),
    sources: ranked.map(({ candidate: c }, i) => ({
      index: i + 1,
      title: c.title,
      url: null,
      snippet: stripSectionHeader(c.text),
      score: Math.round(c.score * 100) / 100,
      page: c.page,
      pageEnd: c.pageEnd,
    })),
  };
}

// ---------- 3. Prompt ----------

function courseList(semesters: SyllabusInfo["semesters"]) {
  if (!semesters.length) return "(no subject list in the database for this year)";
  return semesters
    .map((s) => {
      const total = s.subjects.reduce((sum, x) => sum + x.credits, 0);
      const rows = s.subjects.map((x) => `- ${x.code ? `${x.code} ` : ""}${x.title} · ${x.credits} credits · ${x.kind}`);
      return `Semester ${s.semester} (total ${total} credits)\n${rows.join("\n")}`;
    })
    .join("\n\n");
}

function pageLabel(s: Source) {
  if (!s.page) return "";
  return s.pageEnd && s.pageEnd !== s.page ? `p. ${s.page}-${s.pageEnd}` : `p. ${s.page}`;
}

function systemPrompt(input: AskInput, semesters: SyllabusInfo["semesters"], retrieval: Retrieval) {
  const context = retrieval.sources.length
    ? retrieval.sources.map((s, i) => `[${s.index}]${pageLabel(s) ? ` (${pageLabel(s)})` : ""}\n${retrieval.contexts[i] ?? s.snippet}`).join("\n\n---\n\n")
    : "(nothing in the PDF matched this question)";
  const lowConfidence = retrieval.confident
    ? ""
    : "\n\nNOTE: the search found no strong match in the PDF. Use a passage only if it really answers the question, otherwise say the syllabus does not mention it.";

  return `You are the "Ask your Syllabus" assistant of B.Tech Hub for AKTU B.Tech students. The student is reading the official AKTU syllabus PDF for ${input.branchName} (${input.branch}), Year ${input.year}.

Rules:
- Answer ONLY from the CONTEXT passages (taken from that PDF) and the COURSE LIST. Never use outside knowledge for syllabus facts such as units, topics, books, credits, marks or subject codes.
- Cite the passage after each claim like [1] or [2][3]. Only use numbers that exist in CONTEXT. Facts taken only from the COURSE LIST get no number.
- If the PDF and the COURSE LIST disagree, trust the PDF.
- If something is not covered, say clearly "This syllabus does not mention ...". You may then add one short general explanation, clearly labelled "General note:".
- Markdown, short and direct. Use a table (Unit | Topics) for unit-wise lists. LaTeX ($...$) for formulas. Reply in Hinglish only if the student writes in Hinglish.

COURSE LIST (Year ${input.year}, from the B.Tech Hub database):
${courseList(semesters)}

CONTEXT:
${context}${lowConfidence}`;
}

/** Last 6 turns plus the question, with old [n] markers removed and roles alternating. */
function chatMessages(history: AskTurn[], question: string) {
  const turns = [...history.slice(-6).map((t) => ({ role: t.role, content: t.role === "assistant" ? stripCitations(t.content) : t.content })), { role: "user" as ChatRole, content: question }];
  while (turns[0]?.role === "assistant") turns.shift();
  const merged: AskTurn[] = [];
  for (const t of turns) {
    const prev = merged[merged.length - 1];
    if (prev && prev.role === t.role) prev.content += `\n\n${t.content}`;
    else merged.push({ ...t });
  }
  return merged;
}

// ---------- 4. Streaming answer ----------

/** Gemini without internal retries: on a quota error we switch to Mistral at once instead of waiting. */
function gemini() {
  return new ChatGoogleGenerativeAI({ model: geminiModel(), apiKey: requireEnv("GEMINI_API_KEY"), temperature: 0.2, maxRetries: 0 });
}

function errorStatus(err: unknown) {
  const e = err as { status?: number; response?: { status?: number } };
  return e?.status ?? e?.response?.status;
}

function isRateLimit(err: unknown) {
  const text = err instanceof Error ? err.message : String(err);
  return errorStatus(err) === 429 || /\b429\b|quota|RESOURCE_EXHAUSTED|rate limit/i.test(text);
}

function shouldFallback(err: unknown) {
  const status = errorStatus(err) ?? 0;
  const text = err instanceof Error ? err.message : String(err);
  return isRateLimit(err) || status >= 500 || /\b5\d\d\b|overloaded|unavailable|fetch failed|ECONNRESET|Missing env var GEMINI/i.test(text);
}

async function* streamAnswer(messages: { role: string; content: string }[], signal: AbortSignal): AsyncGenerator<string> {
  let started = false;
  try {
    for await (const chunk of await gemini().stream(messages, { signal })) {
      const text = contentToText(chunk.content);
      if (!text) continue;
      started = true;
      yield text;
    }
    return;
  } catch (err) {
    if (started || signal.aborted || agentProvider() !== "mistral" || !shouldFallback(err)) throw err;
    console.warn("Gemini failed before the first token, using Mistral:", err instanceof Error ? err.message.slice(0, 200) : err);
  }
  for await (const chunk of await agentModel(0.2).stream(messages, { signal })) {
    const text = contentToText(chunk.content);
    if (text) yield text;
  }
}

function errorEvent(err: unknown): AskStreamEvent {
  if (isRateLimit(err)) return { type: "error", message: "The AI is busy right now. Please try again in about 20 seconds.", status: 429 };
  if (err instanceof HttpError) return { type: "error", message: err.message, status: err.status };
  if (err instanceof Error && err.message.startsWith("Missing env var")) return { type: "error", message: err.message, status: 503 };
  return { type: "error", message: "Something went wrong while answering. Please try again.", status: 500 };
}

/**
 * Grounded = the answer cites at least one real passage and is not a "not covered" reply.
 * Vector scores alone cannot decide this: Mistral gives unrelated syllabus text 0.7+ as well.
 */
function isGrounded(answer: string, retrieval: Retrieval) {
  if (!retrieval.sources.length) return false;
  if (/^\W*(this|the) syllabus does not (mention|cover)/i.test(answer)) return false;
  return [...answer.matchAll(/\[(\d{1,2})\]/g)].some((m) => Number(m[1]) >= 1 && Number(m[1]) <= retrieval.sources.length);
}

function persistTurns(input: AskInput, answer: string) {
  db()
    .from("chat_messages")
    .insert([
      { session_id: `ask:${input.fileKey}:${input.userId}`, user_id: input.userId, role: "user", content: input.question, tools_used: [] },
      { session_id: `ask:${input.fileKey}:${input.userId}`, user_id: input.userId, role: "assistant", content: answer, tools_used: ["syllabus"] },
    ])
    .then(({ error }) => error && console.error("ask log failed:", error.message));
}

const encoder = new TextEncoder();

/**
 * NDJSON stream of AskStreamEvent: meta (as soon as retrieval is done), delta..., done.
 * Failures after the stream started become one `error` event. Client disconnects abort the model.
 */
export function askSyllabusStream(input: AskInput): ReadableStream<Uint8Array> {
  const abort = new AbortController();
  const onAbort = () => abort.abort();
  input.signal?.addEventListener("abort", onAbort, { once: true });
  let closed = false;

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: AskStreamEvent) => {
        if (closed || abort.signal.aborted) return;
        try {
          controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
        } catch {
          closed = true;
        }
      };
      try {
        await answer(input, send, abort.signal);
      } catch (err) {
        if (!abort.signal.aborted) {
          console.error("ask failed:", err);
          send(errorEvent(err));
        }
      } finally {
        input.signal?.removeEventListener("abort", onAbort);
        if (!closed) {
          closed = true;
          try {
            controller.close();
          } catch {
            // already cancelled by the client
          }
        }
      }
    },
    cancel() {
      closed = true;
      abort.abort();
    },
  });
}

async function answer(input: AskInput, send: (e: AskStreamEvent) => void, signal: AbortSignal) {
  const cacheKey = input.history.length ? null : `${input.documentId}:${normalizeQuestion(input.question)}`;
  const hit = cacheKey ? answerCache.get(cacheKey) : undefined;
  if (hit) {
    send({ type: "meta", sources: hit.sources, cached: true, query: hit.query });
    send({ type: "delta", text: hit.answer });
    send({ type: "done", answer: hit.answer, grounded: hit.grounded });
    persistTurns(input, hit.answer);
    return;
  }

  const query = input.history.length ? await condenseQuestion(input.question, input.history, signal) : input.question;
  if (signal.aborted) return;

  const title = `${input.branch} Year ${input.year} Syllabus`;
  const [retrieval, semesters] = await Promise.all([
    retrieveSyllabus(input.documentId, query, title),
    getSyllabusSemesters(input.branch, input.year).catch(() => [] as SyllabusInfo["semesters"]),
  ]);
  if (signal.aborted) return;
  send({ type: "meta", sources: retrieval.sources, cached: false, query });

  const messages = [{ role: "system", content: systemPrompt(input, semesters, retrieval) }, ...chatMessages(input.history, input.question)];
  let text = "";
  for await (const delta of streamAnswer(messages, signal)) {
    if (signal.aborted) return;
    text += delta;
    send({ type: "delta", text: delta });
  }
  if (signal.aborted) return;

  const answerText = text.trim() || "Sorry, I could not come up with an answer. Please try again.";
  const grounded = isGrounded(answerText, retrieval);
  send({ type: "done", answer: answerText, grounded });

  if (cacheKey && text.trim()) answerCache.set(cacheKey, { answer: answerText, sources: retrieval.sources, query, grounded });
  persistTurns(input, answerText);
}
