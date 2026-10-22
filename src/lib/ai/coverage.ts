import { db } from "../supabase";

/**
 * Knows which study material is indexed in Pinecone, using the `documents` table
 * (one row per indexed file) joined to `resources` by link. Used to reject questions
 * about material that was never indexed instead of letting the model guess.
 */

export type IndexedSubject = { title: string; codes: string[] };
export type Coverage = { subjects: IndexedSubject[]; codes: Set<string>; documents: number };

const SUBJECT_CODE = /\b(B[A-Z]{2}\d{3}|K[A-Z]{2}\d{3})\b/gi;
const TTL_MS = 60_000;
let cache: { at: number; value: Coverage } | null = null;

export async function getCoverage(): Promise<Coverage> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.value;

  const { data: docs } = await db().from("documents").select("title, source_url, subject_code").eq("status", "indexed").limit(5000);
  const rows = docs ?? [];
  const urls = rows.map((d) => d.source_url).filter(Boolean) as string[];

  const bySubject = new Map<string, Set<string>>();
  const add = (title: string, code?: string | null) => {
    const key = title.trim();
    if (!key) return;
    const codes = bySubject.get(key) ?? new Set<string>();
    if (code) codes.add(code.toUpperCase());
    bySubject.set(key, codes);
  };

  // Files that came from the resources table: use their subject titles
  const linked = new Set<string>();
  for (let i = 0; i < urls.length; i += 200) {
    const { data } = await db().from("resources").select("subject_title, subject_code, url").in("url", urls.slice(i, i + 200));
    for (const r of data ?? []) {
      add(r.subject_title, r.subject_code);
      linked.add(r.url);
    }
  }
  // Syllabus PDFs, admin uploads and student uploads: use the document title
  for (const d of rows) if (!d.source_url || !linked.has(d.source_url)) add(d.title.split(" · ")[0], d.subject_code);

  const subjects = [...bySubject.entries()].map(([title, codes]) => ({ title, codes: [...codes] })).sort((a, b) => a.title.localeCompare(b.title));
  const value: Coverage = { subjects, codes: new Set(subjects.flatMap((s) => s.codes)), documents: rows.length };
  cache = { at: Date.now(), value };
  return value;
}

/** Fast check without any LLM call: an explicit subject code that is not indexed. */
export function unindexedCodes(question: string, coverage: Coverage): string[] {
  const mentioned = [...new Set((question.match(SUBJECT_CODE) ?? []).map((c) => c.toUpperCase()))];
  return mentioned.filter((c) => !coverage.codes.has(c));
}

export function coverageList(coverage: Coverage, max = 12) {
  const names = coverage.subjects.slice(0, max).map((s) => s.title);
  const more = coverage.subjects.length - names.length;
  return names.length ? names.map((n) => `- ${n}`).join("\n") + (more > 0 ? `\n- ...and ${more} more` : "") : "- Nothing has been indexed yet.";
}

export function rejectionMessage(coverage: Coverage, reason: string) {
  return `**This material is not indexed yet**, so I can't answer it from your study material.\n\n${reason}\n\nIndexed so far:\n${coverageList(coverage)}\n\nYou can upload your own notes on the [Upload page](/upload), or ask Vac for a general explanation.`;
}

export function clearCoverageCache() {
  cache = null;
}
