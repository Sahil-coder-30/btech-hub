import type { Metadata } from "next";
import { CgpaCalculator } from "@/components/features/cgpa-calculator";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/supabase";

export const metadata: Metadata = { title: "CGPA Calculator" };
export const dynamic = "force-dynamic";

export default async function CgpaPage() {
  const session = await getSession();
  let saved: Record<number, number> = {};
  if (session) {
    const { data } = await db().from("sgpa_records").select("semester, sgpa").eq("user_id", session.id);
    saved = Object.fromEntries((data ?? []).map((r) => [r.semester, Number(r.sgpa)]));
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <CgpaCalculator saved={saved} loggedIn={Boolean(session)} />
    </div>
  );
}
