import { createHash } from "node:crypto";
import { clearCoverageCache } from "./ai/coverage";
import { HttpError } from "./auth";
import { getBranches, getSubjects } from "./data";
import { isPineconeConfigured } from "./env";
import { isMlConfigured, mlDelete, mlIngest, type IngestResult } from "./ml";
import { db } from "./supabase";
import type { SyllabusIndexStatus, SyllabusInfo, SyllabusLink } from "./types";

/**
 * Ask your Syllabus: one chat-ready index per official syllabus PDF.
 * Many syllabus_links rows share one Drive file, so indexing state is kept per file (file_key)
 * in the syllabus_documents table. Indexing itself runs in the ML service.
 */

export const SYLLABUS_NOT_SET_UP =
  "Ask your Syllabus is not set up yet. Run supabase/migrations/2026_10_ask_syllabus.sql in the Supabase SQL Editor.";
const INDEXING_NOT_CONFIGURED = "Syllabus indexing is not configured. Set ML_SERVICE_URL, ML_SERVICE_TOKEN and PINECONE_API_KEY.";

/** An `indexing` lock older than this is treated as dead (server restart, crash) and may be taken again. */
const STALE_LOCK_MS = 8 * 60_000;
const LINKS_TTL_MS = 60_000;
const CATALOGUE_TTL_MS = 10 * 60_000;
const INFO_TTL_MS = 60_000;

export type SyllabusLinkRow = SyllabusLink & { fileKey: string };

export type SyllabusDocRow = {
  file_key: string;
  source_url: string;
  document_id: string | null;
  status: SyllabusIndexStatus;
  page_count: number | null;
  chunk_count: number | null;
  error: string | null;
  started_at: string | null;
  updated_at: string;
};

// ---------- File key ----------

/** Drive file id from a share link, else a stable hash of the url. */
export function fileKeyFromUrl(url: string): string {
  const match = url.match(/\/d\/([\w-]+)/) ?? url.match(/[?&]id=([\w-]+)/);
  if (match) return match[1];
  return createHash("sha1").update(url).digest("hex").slice(0, 24);
}

export function isDriveUrl(url: string) {
  return /(^|\.)google\.com$/.test(safeHost(url)) && /\/d\/[\w-]+|[?&]id=[\w-]+/.test(url);
}

function safeHost(url: string) {
  try {
    return new URL(url).hostname;
  } catch {
    return "";
  }
}

export function syllabusFileName(branch?: string | null, year?: number | null) {
  const b = branch && /^[A-Z]{2,10}$/.test(branch) ? `_${branch}` : "";
  const y = year && year >= 1 && year <= 4 ? `_Year_${year}` : "";
  return `AKTU_BTech${b}${y}_Syllabus.pdf`;
}

// ---------- Small caches ----------

function memo<T>(ttlMs: number) {
  const entries = new Map<string, { at: number; value: Promise<T> }>();
  return {
    get(key: string, load: () => Promise<T>): Promise<T> {
      const hit = entries.get(key);
      if (hit && Date.now() - hit.at < ttlMs) return hit.value;
      const value = load();
      entries.set(key, { at: Date.now(), value });
      // A failed load must not stay cached
      value.catch(() => entries.get(key)?.value === value && entries.delete(key));
      return value;
    },
    clear() {
      entries.clear();
    },
  };
}

const linksMemo = memo<SyllabusLinkRow[]>(LINKS_TTL_MS);
const branchesMemo = memo<Map<string, string>>(CATALOGUE_TTL_MS);
const semestersMemo = memo<SyllabusInfo["semesters"]>(CATALOGUE_TTL_MS);
/** Only `ready` infos are cached: status changes must show up at once while the client polls. */
const infoCache = new Map<string, { at: number; value: SyllabusInfo }>();

function invalidateInfo() {
  infoCache.clear();
  linksMemo.clear();
}

// ---------- Links and catalogue ----------

export function allSyllabusLinks(): Promise<SyllabusLinkRow[]> {
  return linksMemo.get("all", async () => {
    const { data, error } = await db().from("syllabus_links").select("*").order("branch_code").order("year");
    if (error) throw error;
    return (data as SyllabusLink[]).map((l) => ({ ...l, fileKey: fileKeyFromUrl(l.url) }));
  });
}

export async function findSyllabusLink(branch: string, year: number) {
  return (await allSyllabusLinks()).find((l) => l.branch_code === branch && l.year === year) ?? null;
}

export async function linksForFileKey(fileKey: string) {
  return (await allSyllabusLinks()).filter((l) => l.fileKey === fileKey);
}

function branchNames() {
  return branchesMemo.get("all", async () => new Map((await getBranches()).map((b) => [b.code, b.name])));
}

const CODE_TOKEN = String.raw`(?:[A-Z]{2,5} ?\d[\dA-Z]*\**|[A-Z]{3,5}\*+)`;
const CODE_GROUP = new RegExp(String.raw`\s*\(\s*${CODE_TOKEN}(?:\s*\/\s*${CODE_TOKEN})*\s*\)`, "g");
const REAL_CODE = /\b([BK][A-Z]{2,3}) ?(\d{3}[A-Z]?)\b/;

/** Some imported titles use Greek capitals that look Latin, for example "ΒΜΕ 501". */
const GREEK_LOOKALIKES: Record<string, string> = { Α: "A", Β: "B", Ε: "E", Ζ: "Z", Η: "H", Ι: "I", Κ: "K", Μ: "M", Ν: "N", Ο: "O", Ρ: "P", Τ: "T", Υ: "Y", Χ: "X" };
const latin = (text: string) => text.replace(/[ΑΒΕΖΗΙΚΜΝΟΡΤΥΧ]/g, (c) => GREEK_LOOKALIKES[c] ?? c);

/**
 * "Data Structure (BCS301)" -> "Data Structure", "Departmental Elective-I (Dept Elective-I)" -> "Departmental Elective-I".
 * Keeps other brackets such as "(Maths- III/Math IV/ Math V)".
 */
export function cleanSubjectTitle(title: string) {
  return latin(title)
    .replace(CODE_GROUP, "")
    .replace(/^((?:Departmental|Open) Elective-[IVX]+)\s*\((?:Dept\.?|Deptt\.?|Open)[^)]*\)$/i, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

/** primary_code, or the first real subject code in the title ("BME 501" -> "BME501"). Wildcards like BOE3** are not codes. */
function subjectCode(primary: string | null, title: string) {
  if (primary && !primary.includes("*")) return latin(primary).replace(/\s+/g, "");
  const match = latin(title).match(REAL_CODE);
  return match ? match[1] + match[2] : null;
}

/** Subjects of this branch and year grouped by semester (first year is common to all branches). */
export function getSyllabusSemesters(branch: string, year: number): Promise<SyllabusInfo["semesters"]> {
  return semestersMemo.get(`${branch}:${year}`, async () => {
    const subjects = await getSubjects({ year, branch });
    const bySemester = new Map<number, SyllabusInfo["semesters"][number]["subjects"]>();
    for (const s of subjects) {
      const list = bySemester.get(s.semester) ?? [];
      list.push({
        code: subjectCode(s.primary_code, s.title),
        title: cleanSubjectTitle(s.title) || s.title,
        credits: Number(s.credits) || 0,
        kind: s.kind,
      });
      bySemester.set(s.semester, list);
    }
    return [...bySemester.entries()].sort(([a], [b]) => a - b).map(([semester, list]) => ({ semester, subjects: list }));
  });
}

/**
 * Starter questions built from the real subject list, no LLM call.
 * Picks short core theory subjects so the questions read naturally.
 */
export function buildSuggestions(semesters: SyllabusInfo["semesters"]): string[] {
  const core = semesters.flatMap((s) =>
    s.subjects
      .filter((x) => x.kind === "theory" && x.code && !/elective|\/|\bor\b/i.test(x.title) && x.title.length <= 42)
      .map((x) => ({ ...x, semester: s.semester })),
  );
  const first = core[0];
  const second = core.find((x) => x.semester !== first?.semester) ?? core[1];
  const third = core.find((x) => x !== first && x !== second);
  const withLabs = semesters.find((s) => s.subjects.some((x) => x.kind === "lab"));
  const withElectives = semesters.find((s) => s.subjects.some((x) => /^(departmental|open) elective/i.test(x.title)));
  const last = semesters[semesters.length - 1];

  const out: string[] = [];
  if (first) out.push(`What's in Unit 3 of ${first.title}?`);
  if (last) out.push(`Total credits in Semester ${last.semester}?`);
  if (withLabs) out.push(`Which labs are in Semester ${withLabs.semester}?`);
  if (second) out.push(`Which books are suggested for ${second.title}?`);
  if (withElectives) out.push(`Which electives are offered in Semester ${withElectives.semester}?`);
  else if (third) out.push(`Summarize Unit 1 of ${third.title}`);

  const fallback = [
    "Which subjects are in this year?",
    "Total credits this year?",
    "Which labs are in this syllabus?",
    "How are marks split between internal and external exams?",
  ];
  for (const q of fallback) if (out.length < 4) out.push(q);
  return [...new Set(out)].slice(0, 6);
}

// ---------- syllabus_documents ----------

function isMissingTable(error: { code?: string; message?: string } | null) {
  if (!error) return false;
  return error.code === "PGRST205" || error.code === "42P01" || /syllabus_documents/.test(error.message ?? "");
}

export async function getSyllabusDoc(fileKey: string): Promise<SyllabusDocRow | null> {
  const { data, error } = await db().from("syllabus_documents").select("*").eq("file_key", fileKey).maybeSingle();
  if (isMissingTable(error)) throw new HttpError(503, SYLLABUS_NOT_SET_UP);
  if (error) throw error;
  return (data as SyllabusDocRow) ?? null;
}

function isStale(row: SyllabusDocRow) {
  return !row.started_at || Date.now() - new Date(row.started_at).getTime() > STALE_LOCK_MS;
}

/** What the client sees: a dead lock is reported as failed so the user can retry. */
function effectiveStatus(row: SyllabusDocRow | null): { status: SyllabusIndexStatus; error: string | null } {
  if (!row) return { status: "pending", error: null };
  if (row.status === "ready" && !row.document_id) return { status: "pending", error: null };
  if (row.status === "indexing" && isStale(row)) return { status: "failed", error: "Reading the syllabus took too long. Please try again." };
  return { status: row.status, error: row.status === "failed" ? row.error || "Indexing failed. Please try again." : null };
}

/** The ready document behind a branch and year, or null when it is not chat-ready. */
export async function readySyllabusDocument(link: SyllabusLinkRow) {
  const row = await getSyllabusDoc(link.fileKey);
  const { status } = effectiveStatus(row);
  return status === "ready" && row?.document_id ? { documentId: row.document_id, status, row } : { documentId: null, status, row };
}

// ---------- SyllabusInfo ----------

/** null when the branch is unknown. */
export async function getSyllabusInfo(branchInput: string, year: number): Promise<SyllabusInfo | null> {
  const branch = branchInput.trim().toUpperCase();
  const key = `${branch}:${year}`;
  const hit = infoCache.get(key);
  if (hit && Date.now() - hit.at < INFO_TTL_MS) return hit.value;

  const [names, link, semesters] = await Promise.all([branchNames(), findSyllabusLink(branch, year), getSyllabusSemesters(branch, year)]);
  const branchName = names.get(branch);
  if (!branchName) return null;

  const base = {
    branch,
    branchName,
    year,
    fileName: syllabusFileName(branch, year),
    suggestions: buildSuggestions(semesters),
    semesters,
  };
  if (!link) {
    return {
      ...base,
      fileKey: null,
      pdfUrl: null,
      status: "failed",
      error: "There is no official syllabus PDF for this branch and year yet.",
      pageCount: null,
    };
  }

  let row: SyllabusDocRow | null = null;
  let state: { status: SyllabusIndexStatus; error: string | null };
  try {
    row = await getSyllabusDoc(link.fileKey);
    state = effectiveStatus(row);
  } catch (err) {
    if (!(err instanceof HttpError)) throw err;
    state = { status: "failed", error: err.message };
  }

  const info: SyllabusInfo = {
    ...base,
    fileKey: link.fileKey,
    pdfUrl: `/api/syllabus/pdf/${encodeURIComponent(link.fileKey)}`,
    status: state.status,
    error: state.error,
    pageCount: row?.page_count ?? null,
  };
  if (info.status === "ready") infoCache.set(key, { at: Date.now(), value: info });
  return info;
}

// ---------- Indexing pipeline ----------

export function assertIndexingConfigured() {
  if (!isMlConfigured() || !isPineconeConfigured()) throw new HttpError(503, INDEXING_NOT_CONFIGURED);
}

/**
 * Takes the per-file indexing lock. Returns true when this caller must run the ingestion.
 * Safe under concurrency: the conditional update only matches one writer.
 * force (admin) also re-indexes a ready document, but never steps on a live lock.
 */
export async function claimSyllabus(link: SyllabusLinkRow, force = false): Promise<boolean> {
  const table = () => db().from("syllabus_documents");
  const seeded = await table().upsert({ file_key: link.fileKey, source_url: link.url }, { onConflict: "file_key", ignoreDuplicates: true });
  if (isMissingTable(seeded.error)) throw new HttpError(503, SYLLABUS_NOT_SET_UP);
  if (seeded.error) throw seeded.error;

  const staleBefore = new Date(Date.now() - STALE_LOCK_MS).toISOString();
  const conditions = [
    "status.in.(pending,failed)",
    `and(status.eq.indexing,started_at.lt."${staleBefore}")`,
    "and(status.eq.indexing,started_at.is.null)",
    "and(status.eq.ready,document_id.is.null)",
  ];
  if (force) conditions.push("status.eq.ready");

  const now = new Date().toISOString();
  const { data, error } = await table()
    .update({ status: "indexing", started_at: now, updated_at: now, error: null, source_url: link.url })
    .eq("file_key", link.fileKey)
    .or(conditions.join(","))
    .select("file_key");
  if (error) throw error;
  invalidateInfo();
  return (data?.length ?? 0) > 0;
}

/** Short, user safe reason stored in syllabus_documents.error. */
function safeIndexError(err: unknown) {
  if (err instanceof HttpError) {
    if (err.status === 503) return err.message;
    if (err.status === 504) return "Reading the syllabus took too long. Please try again.";
    if (err.status === 422) return "This syllabus PDF could not be read. Please try again later.";
    if (err.status === 502) return "The indexing service is not reachable right now. Please try again later.";
  }
  return "Indexing failed. Please try again in a minute.";
}

async function setDoc(fileKey: string, patch: Partial<SyllabusDocRow>) {
  const { error } = await db()
    .from("syllabus_documents")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("file_key", fileKey);
  if (error) console.error("syllabus_documents update failed:", error.message);
  invalidateInfo();
}

/** Removes older documents of the same PDF (old pipeline, earlier runs) from Pinecone and Supabase. */
async function deleteLegacyDocuments(fileKey: string, keepId: string) {
  const { data, error } = await db().from("documents").select("id").ilike("source_url", `%${fileKey}%`).neq("id", keepId);
  if (error) return console.error("legacy syllabus lookup failed:", error.message);
  for (const doc of data ?? []) {
    await mlDelete(doc.id).catch((err) => console.error(`legacy syllabus delete ${doc.id} failed:`, err instanceof Error ? err.message : err));
  }
}

const running = new Map<string, Promise<IngestResult>>();

/**
 * Indexes one syllabus PDF through the ML service (page aware) and records the result.
 * Call only after claimSyllabus returned true. Concurrent calls in one process share one run.
 * Throws the ML error (admin route shows it), and stores a user safe error for everyone else.
 */
export function ingestSyllabus(fileKey: string, uploadedBy?: string | null): Promise<IngestResult> {
  const existing = running.get(fileKey);
  if (existing) return existing;
  const run = runIngest(fileKey, uploadedBy).finally(() => running.delete(fileKey));
  running.set(fileKey, run);
  return run;
}

async function runIngest(fileKey: string, uploadedBy?: string | null): Promise<IngestResult> {
  try {
    const links = await linksForFileKey(fileKey);
    if (!links.length) throw new HttpError(404, "Syllabus link not found.");
    const years = [...new Set(links.map((l) => l.year))].sort();
    const branches = [...new Set(links.map((l) => l.branch_code))].sort();
    const firstYear = years.every((y) => y === 1);

    const result = await mlIngest({
      title: `AKTU ${firstYear ? "All Branches" : branches.join("/")} Year ${years.join("/")} Syllabus`,
      url: links[0].url,
      kind: "syllabus",
      years,
      // First year syllabus is common to every branch
      branchCodes: firstYear ? [] : branches,
      uploadedBy: uploadedBy ?? null,
    });
    if (!result.chunks) throw new HttpError(422, "No readable text was found in this PDF.");

    await setDoc(fileKey, {
      status: "ready",
      document_id: result.document_id,
      page_count: result.page_count ?? null,
      chunk_count: result.chunks,
      error: null,
    });
    await db()
      .from("syllabus_links")
      .update({ indexed_at: new Date().toISOString() })
      .in("id", links.map((l) => l.id))
      .then(({ error }) => error && console.error("syllabus_links update failed:", error.message));
    await deleteLegacyDocuments(fileKey, result.document_id);
    clearCoverageCache();
    invalidateInfo();
    return result;
  } catch (err) {
    console.error(`syllabus ingest ${fileKey} failed:`, err instanceof Error ? err.message : err);
    await setDoc(fileKey, { status: "failed", error: safeIndexError(err) });
    throw err;
  }
}
