import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AccountSettings } from "@/components/settings/account-settings";
import { getAccountInfo } from "@/lib/account";
import { getCurrentUser } from "@/lib/auth";

export const metadata: Metadata = { title: "Account" };

export default async function AccountSettingsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/settings/account");
  return <AccountSettings initial={getAccountInfo(user)} />;
}
