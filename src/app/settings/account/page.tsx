import type { Metadata } from "next";
import { AccountSettings } from "@/components/settings/account-settings";
import { getAccountInfo } from "@/lib/account";
import { getCurrentUser } from "@/lib/auth";
import { redirectToLogin } from "@/lib/login-redirect";

export const metadata: Metadata = { title: "Account" };

export default async function AccountSettingsPage() {
  const user = await getCurrentUser();
  if (!user) redirectToLogin("/settings/account");
  return <AccountSettings initial={getAccountInfo(user)} />;
}
