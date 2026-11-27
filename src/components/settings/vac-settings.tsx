"use client";

import { Bot, Brain, Sparkles } from "lucide-react";
import { usePreferences } from "@/components/settings/preferences-context";
import { SettingsHeader, SettingsSection } from "@/components/settings/primitives";
import { VAC_LANGUAGES, VAC_STYLES, VAC_TONES } from "@/lib/settings";
import { cn } from "@/lib/utils";

const LANGUAGE_LABELS: Record<(typeof VAC_LANGUAGES)[number], string> = {
  auto: "Match my language",
  english: "English",
  hinglish: "Hinglish",
  hindi: "Hindi",
};

const STYLE_LABELS: Record<(typeof VAC_STYLES)[number], string> = {
  concise: "Concise",
  balanced: "Balanced",
  detailed: "Detailed",
};

const TONE_LABELS: Record<(typeof VAC_TONES)[number], string> = {
  friendly: "Friendly",
  mentor: "Mentor",
  formal: "Formal",
};

function OptionRow<T extends string>({
  label,
  options,
  labels,
  value,
  onSelect,
}: {
  label: string;
  options: readonly T[];
  labels: Record<T, string>;
  value: T;
  onSelect: (next: T) => void;
}) {
  return (
    <div className="space-y-2 p-5">
      <p className="text-sm font-medium">{label}</p>
      <div className="flex flex-wrap gap-2">
        {options.map((opt) => {
          const active = value === opt;
          return (
            <button
              key={opt}
              type="button"
              aria-pressed={active}
              onClick={() => onSelect(opt)}
              className={cn(
                "rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors",
                active
                  ? "border-[var(--primary)] bg-[var(--primary-soft)] text-[var(--primary-text)]"
                  : "border-border bg-card text-muted-foreground hover:bg-[var(--surface-2)] hover:text-foreground",
              )}
            >
              {labels[opt]}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ToggleRow({
  title,
  description,
  checked,
  onToggle,
}: {
  title: string;
  description: string;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 border-t border-border p-5 first:border-t-0">
      <div>
        <p className="text-sm font-medium">{title}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={onToggle}
        className={cn(
          "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none",
          checked ? "bg-[var(--primary)]" : "bg-muted",
        )}
      >
        <span
          className={cn(
            "pointer-events-none inline-block size-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out",
            checked ? "translate-x-5" : "translate-x-0",
          )}
        />
      </button>
    </div>
  );
}

export function VacSettings() {
  const { preferences, update } = usePreferences();
  const vac = preferences.vac;

  return (
    <div className="space-y-6">
      <SettingsHeader title="Vac AI Preferences" description="Choose how Vac responds and how much of your profile it uses." />

      <SettingsSection title="Response Style" description="Tailor language, depth, and tone" icon={Bot} accent="violet">
        <OptionRow
          label="Reply language"
          options={VAC_LANGUAGES}
          labels={LANGUAGE_LABELS}
          value={vac.language}
          onSelect={(language) => void update({ vac: { language } })}
        />
        <OptionRow
          label="Detail level"
          options={VAC_STYLES}
          labels={STYLE_LABELS}
          value={vac.style}
          onSelect={(style) => void update({ vac: { style } })}
        />
        <OptionRow
          label="Tone"
          options={VAC_TONES}
          labels={TONE_LABELS}
          value={vac.tone}
          onSelect={(tone) => void update({ vac: { tone } })}
        />
      </SettingsSection>

      <SettingsSection title="Personalisation & Assistant Bubble" description="Control context access across the app" icon={Brain} accent="emerald">
        <ToggleRow
          title="Use my academic profile & memory"
          description="Let Vac read your branch, semester, SGPA history, and saved memories"
          checked={vac.useProfile}
          onToggle={() => void update({ vac: { useProfile: !vac.useProfile } })}
        />
        <ToggleRow
          title="Save helpful study notes automatically"
          description="Let Vac remember exams, goals, and difficult topics mentioned in chat"
          checked={vac.memoryEnabled}
          onToggle={() => void update({ vac: { memoryEnabled: !vac.memoryEnabled } })}
        />
        <ToggleRow
          title="Show floating Vac bubble"
          description="Keep quick assistant access visible across portal pages"
          checked={vac.widget}
          onToggle={() => void update({ vac: { widget: !vac.widget } })}
        />
      </SettingsSection>

      <div className="flex items-center gap-2 rounded-xl border border-border bg-surface px-4 py-3 text-xs text-muted-foreground">
        <Sparkles className="size-4 shrink-0 text-primary" aria-hidden />
        <span>Changes apply immediately to new messages in Vac AI Studio and the floating assistant.</span>
      </div>
    </div>
  );
}
