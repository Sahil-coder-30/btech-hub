import { normalizeSettingsTab } from "@/components/settings/settings-tabs";
import { SettingsWorkspace } from "@/components/settings/settings-workspace";
import { getAcademicData, getAccountInfo, getDataSummary } from "@/lib/account";
import { getCurrentUser } from "@/lib/auth";
import { getBranches } from "@/lib/data";
import { redirectToLogin } from "@/lib/login-redirect";
import { computeStats, getProfile, getResultRecords, getSemesterPlan, listMemories, MEMORY_LIMIT } from "@/lib/profile";
import type { StudentInsights } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ tab?: string | string[] }> }) {
  const user = await getCurrentUser();
  if (!user) redirectToLogin("/settings");

  const { tab } = await searchParams;
  const rawTab = typeof tab === "string" ? tab : undefined;

  const [academic, branches, dataSummary, profile, records, memories] = await Promise.all([
    getAcademicData(user),
    getBranches(),
    getDataSummary(user.id),
    getProfile(user.id).catch(() => null),
    getResultRecords(user.id).catch(() => []),
    listMemories(user.id).catch(() => []),
  ]);

  const plan =
    user.branch_code && user.semester
      ? await getSemesterPlan(user.branch_code, user.semester, profile?.electives).catch(() => null)
      : null;

  const insights = profile?.insights && "headline" in profile.insights ? (profile.insights as StudentInsights) : null;
  const stats = computeStats(records, profile?.target_cgpa == null ? null : Number(profile.target_cgpa));
  const hasSavedResult = records.some((r) => r.source === "aktu_result");

  return (
    <SettingsWorkspace
      initialTab={normalizeSettingsTab(rawTab)}
      account={getAccountInfo(user)}
      academic={academic}
      branches={branches}
      hasSavedResult={hasSavedResult}
      stats={stats}
      insights={insights}
      subjects={plan?.subjects ?? []}
      memories={memories}
      memoryLimit={MEMORY_LIMIT}
      now={Date.now()}
      dataSummary={dataSummary}
      isAdmin={user.role === "admin"}
    />
  );
}
