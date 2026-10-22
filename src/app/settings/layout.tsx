import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PreferencesProvider } from "@/components/settings/preferences-context";
import { SettingsNav } from "@/components/settings/settings-nav";
import { getCurrentUser } from "@/lib/auth";
import { readPreferences } from "@/lib/settings";

export const metadata: Metadata = { title: { default: "Settings", template: "%s · Settings | B.Tech Hub" } };
export const dynamic = "force-dynamic";

/** Shared shell for every settings tab. Preferences come from the user row, so this costs no extra query. */
export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/settings");

  return (
    <PreferencesProvider initial={readPreferences(user)}>
      <div className="mx-auto grid max-w-6xl gap-6 px-4 py-8 sm:px-6 lg:grid-cols-[230px_minmax(0,1fr)] lg:gap-10 lg:py-12">
        <aside>
          <p className="mb-3 hidden px-3 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground lg:block">Settings</p>
          <SettingsNav />
        </aside>
        <div className="min-w-0">{children}</div>
      </div>
    </PreferencesProvider>
  );
}
