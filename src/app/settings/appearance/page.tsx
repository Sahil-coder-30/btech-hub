import type { Metadata } from "next";
import { AppearanceSettings } from "@/components/settings/appearance-settings";

export const metadata: Metadata = { title: "Appearance" };

/** Preferences come from the settings layout, so this page needs no data of its own. */
export default function AppearanceSettingsPage() {
  return <AppearanceSettings />;
}
