import type { Metadata } from "next";
import { PrivacySettings } from "@/components/settings/privacy-settings";
import { getDataSummary } from "@/lib/account";
import { getCurrentUser } from "@/lib/auth";
import { redirectToLogin } from "@/lib/login-redirect";

export const metadata: Metadata = { title: "Privacy & data" };

export default async function PrivacySettingsPage() {
  const user = await getCurrentUser();
  if (!user) redirectToLogin("/settings/privacy");
  const summary = await getDataSummary(user.id);
  return <PrivacySettings summary={summary} email={user.email} isAdmin={user.role === "admin"} />;
}
