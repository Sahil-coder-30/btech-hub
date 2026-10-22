import type { Metadata } from "next";
import { Suspense } from "react";
import { AskSyllabus } from "@/components/features/ask-syllabus";
import { getCurrentUser } from "@/lib/auth";
import { getBranches } from "@/lib/data";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ branch?: string | string[]; year?: string | string[] }>;

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

export async function generateMetadata({ searchParams }: { searchParams: SearchParams }): Promise<Metadata> {
  const params = await searchParams;
  const branch = first(params.branch)?.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 10);
  const year = Number(first(params.year));
  const title = branch && year >= 1 && year <= 4 ? `${branch} Year ${year} Syllabus · Ask your Syllabus` : "Ask your Syllabus";
  return {
    title,
    description: "Read the official AKTU syllabus PDF and chat with it. Every answer cites the page it came from.",
  };
}

export default async function AskPage() {
  const [branches, user] = await Promise.all([getBranches(), getCurrentUser().catch(() => null)]);
  const profileYear = user?.year && user.year >= 1 && user.year <= 4 ? user.year : null;

  return (
    <Suspense fallback={null}>
      <AskSyllabus branches={branches} profileBranch={user?.branch_code ?? null} profileYear={profileYear} />
    </Suspense>
  );
}
