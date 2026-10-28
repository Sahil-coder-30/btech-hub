import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Onboarding } from "@/components/features/onboarding";
import { getCurrentUser } from "@/lib/auth";
import { getBranches } from "@/lib/data";
import { getProfile, getResultRecords } from "@/lib/profile";
import { redirectToLogin } from "@/lib/login-redirect";

export const metadata: Metadata = { title: "Build your profile" };
export const dynamic = "force-dynamic";

type SearchParams = Promise<{ next?: string | string[]; redo?: string | string[] }>;

export default async function OnboardingPage({ searchParams }: { searchParams: SearchParams }) {
  const { next, redo } = await searchParams;
  const nextPath = typeof next === "string" && next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/onboarding") ? next : "/dashboard";

  const user = await getCurrentUser();
  if (!user) redirectToLogin("/onboarding");

  // Already onboarded (e.g. a session signed before the flag existed): refresh the cookie and continue
  if ((user.onboarded_at || user.role === "admin") && !redo) {
    redirect(`/api/onboarding/sync?next=${encodeURIComponent(nextPath)}`);
  }

  const [branches, profile, records] = await Promise.all([getBranches(), getProfile(user.id), redo ? getResultRecords(user.id) : []]);
  // When updating, a result uploaded earlier is reused instead of asking for the PDF again
  const savedResult = records.filter((r) => r.source === "aktu_result").map((r) => ({ semester: r.semester, sgpa: Number(r.sgpa) }));

  return (
    <Onboarding
      user={{ name: user.name, branch_code: user.branch_code, semester: user.semester }}
      branches={branches}
      profile={
        profile
          ? { goals: profile.goals, target_cgpa: profile.target_cgpa === null ? null : Number(profile.target_cgpa), note: profile.note, electives: profile.electives }
          : null
      }
      next={nextPath}
      redo={Boolean(redo)}
      savedResult={savedResult.length ? savedResult : null}
    />
  );
}
