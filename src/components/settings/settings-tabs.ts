export type SettingsTabId =
  | "account"
  | "profile"
  | "update-profile"
  | "memory"
  | "vac"
  | "appearance"
  | "privacy"
  | "faq"
  | "about"
  | "contact";

const VALID_SETTINGS_TABS = new Set<string>([
  "account",
  "profile",
  "update-profile",
  "memory",
  "vac",
  "appearance",
  "privacy",
  "faq",
  "about",
  "contact",
]);

export function normalizeSettingsTab(raw?: string | null): SettingsTabId {
  if (!raw) return "account";
  if (raw === "academic") return "update-profile";
  return VALID_SETTINGS_TABS.has(raw) ? (raw as SettingsTabId) : "account";
}
