"use client";

import Link from "next/link";
import { Bot, Database, FileUp, Info, Layers, Lock, Sparkles } from "lucide-react";
import { ContactForm } from "@/components/features/contact-form";
import { ProfileInsights } from "@/components/features/profile-insights";
import { AcademicSettings } from "@/components/settings/academic-settings";
import { SettingsHeader, SettingsSection } from "@/components/settings/primitives";
import { buttonVariants } from "@/components/ui/button";
import { FAQS } from "@/lib/faqs";
import type { CurrentSubject } from "@/lib/profile";
import type { AcademicPayload, Branch, StudentInsights, StudentStats } from "@/lib/types";

const STACK = [
  { icon: Layers, title: "Next.js + TypeScript", text: "App Router, server components, typed API routes, and Tailwind CSS." },
  { icon: Bot, title: "Vac AI Agent", text: "Tool-calling academic assistant for subjects, SGPA/CGPA math, resources, syllabus, quiz, and photo doubts." },
  { icon: Sparkles, title: "Gemini Multimodal", text: "Chat, structured outputs for quizzes and study plans, and vision analysis for question photos." },
  { icon: Database, title: "Supabase + Pinecone", text: "Postgres stores catalog and student records; Pinecone powers syllabus semantic search." },
  { icon: Lock, title: "Google OAuth + JWT", text: "Sign in with Google and signed httpOnly session cookies." },
];

export function MyProfilePanel({
  stats,
  insights,
  subjects,
  onEditProfile,
}: {
  stats: StudentStats | null;
  insights: StudentInsights | null;
  subjects: CurrentSubject[];
  onEditProfile: () => void;
}) {
  return (
    <div className="space-y-6">
      <SettingsHeader
        title="My Profile"
        description="Your AKTU academic summary, subject insights, and this semester's credits."
        action={
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={onEditProfile} className={buttonVariants({ size: "sm", variant: "secondary" })}>
              Update profile
            </button>
            <Link href="/onboarding?redo=1" className={buttonVariants({ size: "sm", variant: "outline" })}>
              Upload result PDF
            </Link>
          </div>
        }
      />
      <ProfileInsights stats={stats} insights={insights} subjects={subjects} />
    </div>
  );
}

export function UpdateProfilePanel({
  academic,
  branches,
  hasSavedResult,
}: {
  academic: AcademicPayload;
  branches: Branch[];
  hasSavedResult: boolean;
}) {
  return (
    <div className="space-y-6">
      <SettingsSection
        title="AKTU Result PDF"
        description={
          hasSavedResult
            ? "Your result PDF is saved. Re-upload any time when a new semester result is declared."
            : "Import your AKTU OneView result PDF to auto-fill semesters, SGPAs, and insights."
        }
        icon={FileUp}
        accent="blue"
        action={
          <Link href="/onboarding?redo=1" className={buttonVariants({ size: "sm", variant: "secondary" })}>
            {hasSavedResult ? "Re-upload PDF" : "Upload result PDF"}
          </Link>
        }
      >
        <div className="px-5 py-3 text-xs text-muted-foreground">
          PDF upload runs in the guided importer and syncs back into your profile automatically.
        </div>
      </SettingsSection>

      <AcademicSettings initial={academic} branches={branches} />
    </div>
  );
}

export function FaqSettingsPanel() {
  return (
    <div className="space-y-6">
      <SettingsHeader title="Frequently Asked Questions" description="Quick answers about grades, Vac AI, syllabus search, and privacy." />
      <div className="space-y-2.5">
        {FAQS.map((f) => (
          <details key={f.q} className="group rounded-2xl border border-border bg-card p-4 sm:p-5 [&_summary::-webkit-details-marker]:hidden">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-sm font-medium text-foreground">
              {f.q}
              <span className="text-muted-foreground transition-transform group-open:rotate-45">+</span>
            </summary>
            <p className="mt-2.5 text-sm leading-relaxed text-muted-foreground">{f.a}</p>
          </details>
        ))}
      </div>
    </div>
  );
}

export function AboutSettingsPanel() {
  return (
    <div className="space-y-6">
      <SettingsHeader title="About B.Tech Hub" description="One workspace for AKTU calculators, circulars, notes, syllabus search, and Vac AI." />
      <div className="grid gap-3 sm:grid-cols-2">
        {STACK.map((s) => (
          <div key={s.title} className="rounded-2xl border border-border bg-card p-4">
            <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <s.icon className="size-4 text-primary" aria-hidden /> {s.title}
            </p>
            <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{s.text}</p>
          </div>
        ))}
      </div>
      <div className="flex items-start gap-2.5 rounded-2xl border border-border bg-surface px-4 py-3.5 text-xs leading-relaxed text-muted-foreground">
        <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
        <span>Built by Sahil Sharma for AKTU students. Student project, not affiliated with AKTU. Verify official circulars on aktu.ac.in.</span>
      </div>
    </div>
  );
}

export function ContactSettingsPanel() {
  return (
    <div className="space-y-6">
      <SettingsHeader title="Contact Support" description="Found a broken link, want a new feature, or want to share notes? Send a message." />
      <ContactForm />
    </div>
  );
}
