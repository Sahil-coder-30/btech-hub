"use client";

import { useTheme } from "next-themes";
import { Monitor, Moon, Sun, Wand2 } from "lucide-react";
import { usePreferences } from "@/components/settings/preferences-context";
import { SettingsHeader, SettingsSection } from "@/components/settings/primitives";
import { cn } from "@/lib/utils";

export function AppearanceSettings() {
  const { preferences, update } = usePreferences();
  const { theme, setTheme } = useTheme();

  const themes = [
    { value: "system", label: "System", icon: Monitor, description: "Follow your device operating system appearance" },
    { value: "dark", label: "Dark", icon: Moon, description: "Deep dark mode tailored for long study sessions" },
    { value: "light", label: "Light", icon: Sun, description: "Crisp, clean high-contrast light theme" },
  ] as const;

  const currentTheme = preferences.appearance?.theme ?? theme ?? "dark";
  const reduceMotion = preferences.appearance?.reduceMotion ?? false;

  return (
    <div className="space-y-6">
      <SettingsHeader
        title="Appearance"
        description="Customize how B.Tech Hub looks on your device. Themes and visual preferences sync automatically."
      />

      <SettingsSection title="Theme" description="Select your preferred color theme" icon={Sun} accent="amber">
        <div className="grid gap-3 p-5 sm:grid-cols-3">
          {themes.map((t) => {
            const Icon = t.icon;
            const active = currentTheme === t.value;
            return (
              <button
                key={t.value}
                type="button"
                onClick={() => {
                  setTheme(t.value);
                  update({ appearance: { theme: t.value } });
                }}
                className={cn(
                  "flex flex-col items-start gap-2.5 rounded-xl border p-4 text-left transition-all",
                  active
                    ? "border-[var(--primary)] bg-[var(--primary-soft)] text-[var(--primary-text)] shadow-xs"
                    : "border-border bg-card hover:bg-muted/50 text-foreground"
                )}
              >
                <div className="flex w-full items-center justify-between">
                  <Icon className="size-5" />
                  {active && <span className="size-2 rounded-full bg-[var(--primary)]" />}
                </div>
                <div>
                  <p className="font-medium text-sm">{t.label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-snug">{t.description}</p>
                </div>
              </button>
            );
          })}
        </div>
      </SettingsSection>

      <SettingsSection
        title="Visual Motion"
        description="Control animations and transitions across the application"
        icon={Wand2}
        accent="violet"
      >
        <div className="flex items-center justify-between p-5">
          <div>
            <p className="font-medium text-sm">Reduce Motion</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Minimize animations and smooth scroll effects for reduced eye strain
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={reduceMotion}
            onClick={() => update({ appearance: { reduceMotion: !reduceMotion } })}
            className={cn(
              "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none",
              reduceMotion ? "bg-[var(--primary)]" : "bg-muted"
            )}
          >
            <span
              className={cn(
                "pointer-events-none inline-block size-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out",
                reduceMotion ? "translate-x-5" : "translate-x-0"
              )}
            />
          </button>
        </div>
      </SettingsSection>
    </div>
  );
}
