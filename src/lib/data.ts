import { db } from "./supabase";
import type { Branch, Resource, Subject, SyllabusLink, UniversityInfo } from "./types";

/** Read helpers for the academic catalogue. All run on the server. */

export async function getBranches(): Promise<Branch[]> {
  const { data, error } = await db().from("branches").select("*").order("sort_order");
  if (error) throw error;
  return data as Branch[];
}

export async function getAllSubjects(): Promise<Subject[]> {
  const { data, error } = await db().from("subjects").select("*").order("sort_order");
  if (error) throw error;
  return data as Subject[];
}

export async function getSubjects(filter: { year: number; semester?: number; branch?: string | null }) {
  let query = db().from("subjects").select("*").eq("year", filter.year).order("sort_order");
  if (filter.semester) query = query.eq("semester", filter.semester);
  if (filter.year > 1 && filter.branch) query = query.eq("branch_code", filter.branch);
  const { data, error } = await query;
  if (error) throw error;
  return data as Subject[];
}

export async function getResources(filter: {
  year?: number;
  semester?: number;
  branch?: string | null;
  search?: string;
  type?: string;
  limit?: number;
}) {
  let query = db().from("resources").select("*").order("id").limit(filter.limit ?? 2000);
  if (filter.year) query = query.eq("year", filter.year);
  if (filter.semester && filter.year !== 1) query = query.eq("semester", filter.semester);
  if (filter.branch && filter.year !== 1) query = query.eq("branch_code", filter.branch);
  if (filter.type) query = query.eq("type", filter.type);
  if (filter.search) {
    const s = filter.search.replace(/[%,()]/g, " ").trim();
    query = query.or(`subject_title.ilike.%${s}%,subject_code.ilike.%${s}%`);
  }
  const { data, error } = await query;
  if (error) throw error;
  return data as Resource[];
}

export async function getSyllabusLinks(): Promise<SyllabusLink[]> {
  const { data, error } = await db().from("syllabus_links").select("*").order("branch_code").order("year");
  if (error) throw error;
  return data as SyllabusLink[];
}

export async function getUniversityInfo(): Promise<UniversityInfo[]> {
  const { data, error } = await db().from("university_info").select("*").order("sort_order");
  if (error) throw error;
  return data as UniversityInfo[];
}

/**
 * Readable names for subject codes, taken from resource titles such as
 * "Departmental Elective-I (Data Analytics) (BCS052)". Used for elective pickers.
 */
export async function getSubjectNames(codes: string[]): Promise<Record<string, string>> {
  if (!codes.length) return {};
  const { data, error } = await db().from("resources").select("subject_code, subject_title").in("subject_code", codes);
  if (error) throw error;
  const names: Record<string, string> = {};
  for (const r of data ?? []) {
    if (names[r.subject_code]) continue;
    const title = String(r.subject_title).replace(/\s*\([A-Z0-9*]+\)\s*$/, "");
    names[r.subject_code] = title.match(/\(([^()]+)\)\s*$/)?.[1] ?? title;
  }
  return names;
}
