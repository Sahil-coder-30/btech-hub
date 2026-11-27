"use client";

import {
  Bot,
  Brain,
  ChevronDown,
  HelpCircle,
  Info,
  Mail,
  Palette,
  ShieldCheck,
  Sparkles,
  UserCog,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { AccountSettings } from "@/components/settings/account-settings";
import { AppearanceSettings } from "@/components/settings/appearance-settings";
import {
  AboutSettingsPanel,
  ContactSettingsPanel,
  FaqSettingsPanel,
  MyProfilePanel,
  UpdateProfilePanel,
} from "@/components/settings/info-sections";
import { MemoryManager } from "@/components/settings/memory-manager";
import { PrivacySettings } from "@/components/settings/privacy-settings";
import { normalizeSettingsTab, type SettingsTabId } from "@/components/settings/settings-tabs";
import { VacSettings } from "@/components/settings/vac-settings";
import type { CurrentSubject } from "@/lib/profile";
import type {
  AcademicPayload,
  AccountInfo,
  Branch,
  DataSummary,
  StudentInsights,
  StudentMemory,
  StudentStats,
} from "@/lib/types";
import { cn } from "@/lib/utils";

type TabDef = { id: SettingsTabId; label: string; icon: LucideIcon };
type TabGroup = { group: string; items: TabDef[] };

const TAB_GROUPS: TabGroup[] = [
  {
    group: "Account & Profile",
    items: [
      { id: "account", label: "Account", icon: UserRound },
      { id: "profile", label: "My Profile", icon: Sparkles },
      { id: "update-profile", label: "Update Profile", icon: UserCog },
      { id: "memory", label: "Vac Memory", icon: Brain },
    ],
  },
  {
    group: "Preferences",
    items: [
      { id: "vac", label: "Vac AI", icon: Bot },
      { id: "appearance", label: "Appearance", icon: Palette },
      { id: "privacy", label: "Privacy & Data", icon: ShieldCheck },
    ],
  },
  {
    group: "Help & Info",
    items: [
      { id: "faq", label: "FAQ", icon: HelpCircle },
      { id: "about", label: "About", icon: Info },
      { id: "contact", label: "Contact", icon: Mail },
    ],
  },
];

export type SettingsWorkspaceProps = {
  initialTab: SettingsTabId;
  account: AccountInfo;
  academic: AcademicPayload;
  branches: Branch[];
  hasSavedResult: boolean;
  stats: StudentStats | null;
  insights: StudentInsights | null;
  subjects: CurrentSubject[];
  memories: StudentMemory[];
  memoryLimit: number;
  now: number;
  dataSummary: DataSummary;
  isAdmin: boolean;
};

function MobileTabPicker({
  activeTab,
  onSelect,
}: {
  activeTab: SettingsTabId;
  onSelect: (tab: SettingsTabId) => void;
}) {
  return (
    <div className="border-b border-border bg-surface px-4 py-3 lg:hidden">
      <label htmlFor="settings-section-select" className="sr-only">
        Settings section
      </label>
      <div className="relative">
        <select
          id="settings-section-select"
          value={activeTab}
          onChange={(e) => onSelect(e.target.value as SettingsTabId)}
          className="w-full appearance-none rounded-xl border border-border bg-bg py-2 pl-3.5 pr-9 text-sm font-medium text-foreground focus-visible:outline-none"
        >
          {TAB_GROUPS.map((g) => (
            <optgroup key={g.group} label={g.group}>
              {g.items.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
      </div>
    </div>
  );
}

function renderActiveTab(props: SettingsWorkspaceProps, activeTab: SettingsTabId, selectTab: (t: SettingsTabId) => void) {
  switch (activeTab) {
    case "account":
      return <AccountSettings initial={props.account} />;
    case "profile":
      return <MyProfilePanel stats={props.stats} insights={props.insights} subjects={props.subjects} onEditProfile={() => selectTab("update-profile")} />;
    case "update-profile":
      return <UpdateProfilePanel academic={props.academic} branches={props.branches} hasSavedResult={props.hasSavedResult} />;
    case "memory":
      return <MemoryManager initial={props.memories} limit={props.memoryLimit} now={props.now} />;
    case "vac":
      return <VacSettings />;
    case "appearance":
      return <AppearanceSettings />;
    case "privacy":
      return <PrivacySettings summary={props.dataSummary} email={props.account.email} isAdmin={props.isAdmin} />;
    case "faq":
      return <FaqSettingsPanel />;
    case "about":
      return <AboutSettingsPanel />;
    case "contact":
      return <ContactSettingsPanel />;
  }
}

export function SettingsWorkspace(props: SettingsWorkspaceProps) {
  const [activeTab, setActiveTab] = useState<SettingsTabId>(props.initialTab);
  const contentRef = useRef<HTMLDivElement>(null);

  const selectTab = useCallback((next: SettingsTabId) => {
    setActiveTab(next);
    const url = next === "account" ? "/settings" : `/settings?tab=${next}`;
    if (`${window.location.pathname}${window.location.search}` !== url) {
      window.history.replaceState(null, "", url);
    }
  }, []);

  useEffect(() => {
    contentRef.current?.scrollTo({ top: 0, behavior: "auto" });
  }, [activeTab]);

  useEffect(() => {
    const onPopState = () => {
      const sp = new URLSearchParams(window.location.search);
      setActiveTab(normalizeSettingsTab(sp.get("tab")));
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  return (
    <div className="flex h-[calc(100dvh-64px)] flex-col overflow-hidden bg-[var(--bg)] lg:h-screen lg:flex-row">
      <MobileTabPicker activeTab={activeTab} onSelect={selectTab} />

      <aside
        aria-label="Settings sections"
        className="hidden lg:flex w-[240px] shrink-0 flex-col border-r border-border bg-[var(--surface)] select-none"
      >
        <div className="flex h-16 shrink-0 items-center border-b border-border px-5">
          <h1 className="font-display text-base font-bold tracking-tight text-foreground">Settings</h1>
        </div>

        <nav aria-label="Settings navigation" className="flex-1 overflow-y-auto p-3 space-y-5 scrollbar-thin">
          {TAB_GROUPS.map((group) => (
            <div key={group.group} className="space-y-1">
              <p className="px-2.5 text-[10.5px] font-bold uppercase tracking-wider text-muted-foreground font-mono">
                {group.group}
              </p>
              <ul className="space-y-0.5">
                {group.items.map(({ id, label, icon: Icon }) => {
                  const active = activeTab === id;
                  return (
                    <li key={id}>
                      <button
                        type="button"
                        onClick={() => selectTab(id)}
                        aria-current={active ? "page" : undefined}
                        className={cn(
                          "flex h-9 w-full items-center gap-2.5 rounded-xl px-2.5 text-left text-[13px] transition-colors",
                          active
                            ? "bg-[var(--primary-soft)] font-semibold text-[var(--primary-text)] shadow-xs"
                            : "text-[var(--fg-2)] hover:bg-[var(--surface-2)] hover:text-foreground",
                        )}
                      >
                        <Icon className={cn("size-4 shrink-0", active ? "text-[var(--primary-text)]" : "text-muted-foreground")} aria-hidden />
                        <span className="truncate">{label}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>
      </aside>

      <div ref={contentRef} className="flex-1 overflow-y-auto overscroll-contain px-4 py-6 sm:px-8 sm:py-9">
        <div className="mx-auto max-w-3xl pb-12">{renderActiveTab(props, activeTab, selectTab)}</div>
      </div>
    </div>
  );
}
