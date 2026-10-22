import type { Metadata } from "next";
import { SgpaCalculator } from "@/components/features/sgpa-calculator";
import { getSession } from "@/lib/auth";
import { getAllSubjects, getBranches } from "@/lib/data";

export const metadata: Metadata = { title: "SGPA Calculator" };
export const dynamic = "force-dynamic";

export default async function SgpaPage() {
  const [subjects, branches, session] = await Promise.all([getAllSubjects(), getBranches(), getSession()]);
  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <SgpaCalculator subjects={subjects} branches={branches} loggedIn={Boolean(session)} />
    </div>
  );
}
