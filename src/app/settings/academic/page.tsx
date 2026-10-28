import type { Metadata } from "next";
import { AcademicSettings } from "@/components/settings/academic-settings";
import { getAcademicData } from "@/lib/account";
import { getCurrentUser } from "@/lib/auth";
import { getBranches } from "@/lib/data";
import { redirectToLogin } from "@/lib/login-redirect";

export const metadata: Metadata = { title: "Academic" };

export default async function AcademicSettingsPage() {
  const user = await getCurrentUser();
  if (!user) redirectToLogin("/settings/academic");
  const [initial, branches] = await Promise.all([getAcademicData(user), getBranches()]);
  return <AcademicSettings initial={initial} branches={branches} />;
}
