import type { Metadata } from "next";
import Link from "next/link";
import { ProfileInsights } from "@/components/features/profile-insights";
import { DashHeader, DashPage } from "@/components/dashboard/ui";
import { buttonVariants } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/auth";
import { computeStats, getProfile, getResultRecords, getSemesterPlan } from "@/lib/profile";
import type { StudentInsights } from "@/lib/types";
import { redirectToLogin } from "@/lib/login-redirect";

export const metadata: Metadata = { title: "My profile" };
export const dynamic = "force-dynamic";

/** Full academic profile: stats, AI insights, exam gaps and this semester's subjects. */
export default async function ProfilePage() {
  const user = await getCurrentUser();
  if (!user) redirectToLogin("/dashboard/profile");

  const [profile, records] = await Promise.all([getProfile(user.id).catch(() => null), getResultRecords(user.id).catch(() => [])]);
  const plan = user.branch_code && user.semester ? await getSemesterPlan(user.branch_code, user.semester, profile?.electives).catch(() => null) : null;
  const insights = profile?.insights && "headline" in profile.insights ? (profile.insights as StudentInsights) : null;

  return (
    <DashPage className="space-y-6">
      <DashHeader
        title="My academic profile"
        description="Built from your AKTU result, this semester's subjects and your goals."
        actions={
          <>
            <Link href="/onboarding?redo=1" className={buttonVariants({ size: "sm", variant: "secondary" })}>
              Update result
            </Link>
            <Link href="/dashboard/memory" className={buttonVariants({ size: "sm", variant: "ghost" })}>
              What Vac remembers
            </Link>
          </>
        }
      />
      <ProfileInsights
        stats={computeStats(records, profile?.target_cgpa == null ? null : Number(profile.target_cgpa))}
        insights={insights}
        subjects={plan?.subjects ?? []}
      />
    </DashPage>
  );
}
