import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Onboarding } from "@/components/features/onboarding";
import { getCurrentUser } from "@/lib/auth";
import { getBranches } from "@/lib/data";
import { getProfile } from "@/lib/profile";

export const metadata: Metadata = { title: "Build your profile" };
export const dynamic = "force-dynamic";

type SearchParams = Promise<{ next?: string | string[]; redo?: string | string[] }>;

export default async function OnboardingPage({ searchParams }: { searchParams: SearchParams }) {
  const { next, redo } = await searchParams;
  const nextPath = typeof next === "string" && next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/onboarding") ? next : "/dashboard";

  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/onboarding");

  // Already onboarded (e.g. a session signed before the flag existed): refresh the cookie and continue
  if ((user.onboarded_at || user.role === "admin") && !redo) {
    redirect(`/api/onboarding/sync?next=${encodeURIComponent(nextPath)}`);
  }

  const [branches, profile] = await Promise.all([getBranches(), getProfile(user.id)]);

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
    />
  );
}
