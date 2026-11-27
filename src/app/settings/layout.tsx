import type { Metadata } from "next";
import { PreferencesProvider } from "@/components/settings/preferences-context";
import { getCurrentUser } from "@/lib/auth";
import { readPreferences } from "@/lib/settings";
import { redirectToLogin } from "@/lib/login-redirect";

export const metadata: Metadata = { title: "Settings" };
export const dynamic = "force-dynamic";

export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirectToLogin("/settings");

  return <PreferencesProvider initial={readPreferences(user)}>{children}</PreferencesProvider>;
}
