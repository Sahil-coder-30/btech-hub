"use client";

import { ShieldCheck, MessageSquare, Database } from "lucide-react";
import { usePreferences } from "@/components/settings/preferences-context";
import { SettingsHeader, SettingsSection } from "@/components/settings/primitives";
import type { DataSummary } from "@/lib/types";
import { cn } from "@/lib/utils";

export function PrivacySettings({
  summary,
  email,
  isAdmin,
}: {
  summary: DataSummary;
  email: string;
  isAdmin: boolean;
}) {
  const { preferences, update } = usePreferences();
  const saveChatHistory = preferences.privacy?.saveChatHistory ?? true;

  return (
    <div className="space-y-6">
      <SettingsHeader
        title="Privacy & Data"
        description={`Manage your stored academic data for ${email}. You have full control over your privacy.`}
      />

      <SettingsSection
        title="Chat Transcripts"
        description="Choose whether Vac stores your study conversations for personalized review"
        icon={MessageSquare}
        accent="emerald"
      >
        <div className="flex items-center justify-between p-5">
          <div>
            <p className="font-medium text-sm">Save Chat History</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Keep previous conversations in Vac AI Studio to continue where you left off
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={saveChatHistory}
            onClick={() => update({ privacy: { saveChatHistory: !saveChatHistory } })}
            className={cn(
              "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none",
              saveChatHistory ? "bg-[var(--primary)]" : "bg-muted"
            )}
          >
            <span
              className={cn(
                "pointer-events-none inline-block size-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out",
                saveChatHistory ? "translate-x-5" : "translate-x-0"
              )}
            />
          </button>
        </div>
      </SettingsSection>

      <SettingsSection
        title="Data Summary"
        description="Records currently associated with your account"
        icon={Database}
        accent="blue"
      >
        <div className="grid grid-cols-2 gap-3 p-5 sm:grid-cols-4">
          <div className="rounded-xl border border-border p-3">
            <p className="text-xs text-muted-foreground">Chat Messages</p>
            <p className="text-lg font-semibold mt-1">{summary.chatMessages}</p>
          </div>
          <div className="rounded-xl border border-border p-3">
            <p className="text-xs text-muted-foreground">Quiz Attempts</p>
            <p className="text-lg font-semibold mt-1">{summary.quizAttempts}</p>
          </div>
          <div className="rounded-xl border border-border p-3">
            <p className="text-xs text-muted-foreground">Study Plans</p>
            <p className="text-lg font-semibold mt-1">{summary.studyPlans}</p>
          </div>
          <div className="rounded-xl border border-border p-3">
            <p className="text-xs text-muted-foreground">Saved Resources</p>
            <p className="text-lg font-semibold mt-1">{summary.savedResources}</p>
          </div>
        </div>
      </SettingsSection>
    </div>
  );
}
