import { NextResponse } from "next/server";
import { handler } from "@/lib/api";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/supabase";

/** GET /api/search?q=: quick search over subjects and resources for the Cmd+K menu. */
export const GET = handler(async (request: Request) => {
  await requireSession();
  const q = (new URL(request.url).searchParams.get("q") ?? "").replace(/[%,()]/g, " ").trim().slice(0, 60);
  if (q.length < 2) return NextResponse.json({ subjects: [], resources: [] });

  const [subjects, resources] = await Promise.all([
    db()
      .from("subjects")
      .select("id, title, primary_code, year, semester, branch_code, credits")
      .or(`title.ilike.%${q}%,primary_code.ilike.%${q}%`)
      .limit(8),
    db()
      .from("resources")
      .select("id, subject_title, type, label, url, year, branch_code")
      .not("url", "is", null)
      .or(`subject_title.ilike.%${q}%,subject_code.ilike.%${q}%`)
      .limit(8),
  ]);

  // The same subject repeats once per branch, show each title once
  const seen = new Set<string>();
  const uniqueSubjects = (subjects.data ?? []).filter((s) => !seen.has(s.title) && seen.add(s.title));

  return NextResponse.json({ subjects: uniqueSubjects, resources: resources.data ?? [] });
});
