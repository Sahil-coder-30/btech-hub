"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { Calculator, BookOpen, Bot, CalendarCheck, ArrowRight, TrendingUp, FileText, Camera, ListChecks } from "lucide-react";
import { SectionHeader } from "./section-header";

type Action = { label: string; icon?: ReactNode } & ({ href: string } | { prompt: string });

type Module = {
  title: string;
  desc: string;
  badge: string;
  icon: ReactNode;
  iconBg: string;
  iconFg?: string;
  tags: string[];
  primary: Action;
  secondary: Action;
};

const MODULES: Module[] = [
  {
    title: "SGPA & CGPA Studio",
    desc: "Pick your branch and semester, enter marks, and get a credit weighted SGPA. Convert CGPA to percentage and plan the SGPA you need next.",
    badge: "AKTU 10 point scale",
    icon: <Calculator className="size-[22px]" />,
    iconBg: "var(--primary-soft)",
    iconFg: "var(--primary-text)",
    tags: ["Credit weighted", "Target planner", "Saved to your account"],
    primary: { label: "SGPA Calculator", href: "/sgpa" },
    secondary: { label: "CGPA Planner", href: "/cgpa", icon: <TrendingUp className="size-3.5" /> },
  },
  {
    title: "Syllabus, Notes & PYQs",
    desc: "Official AKTU syllabus for all 9 branches, unit wise notes and previous year papers, sorted by year, semester and subject code.",
    badge: "434 subjects",
    icon: <BookOpen className="size-[22px]" />,
    iconBg: "var(--success-soft)",
    iconFg: "var(--success)",
    tags: ["9 branches", "Official PDFs", "Previous year papers"],
    primary: { label: "Ask your Syllabus", href: "/ask" },
    secondary: { label: "Notes & PYQs", href: "/resources", icon: <FileText className="size-3.5" /> },
  },
  {
    title: "Vac AI Copilot",
    desc: "A study agent that searches your syllabus PDFs, does the grade maths with real credits and explains answers in English or Hinglish.",
    badge: "12 agent tools",
    icon: <img src="/images/vac-robot.gif" alt="" style={{ width: "34px", height: "34px", objectFit: "cover", borderRadius: "99px" }} />,
    iconBg: "var(--primary-soft)",
    tags: ["Cited sources", "Hinglish OK", "Step by step"],
    primary: { label: "Ask Vac", prompt: "Help me understand my semester syllabus and marks.", icon: <Bot className="size-3.5" /> },
    secondary: { label: "Photo Doubt", href: "/doubt", icon: <Camera className="size-3.5" /> },
  },
  {
    title: "AI Quiz & Study Planner",
    desc: "Unit wise MCQs that track your weak topics, and a day wise revision plan from today to your exam date that you can add to your calendar.",
    badge: "Exam ready",
    icon: <CalendarCheck className="size-[22px]" />,
    iconBg: "var(--warning-soft)",
    iconFg: "var(--warning)",
    tags: ["Unit wise MCQs", "Weak topic list", "Calendar export"],
    primary: { label: "Take a Quiz", href: "/quiz", icon: <ListChecks className="size-3.5" /> },
    secondary: { label: "Exam Planner", href: "/planner", icon: <CalendarCheck className="size-3.5" /> },
  },
];

function ActionButton({ action, variant }: { action: Action; variant: "primary" | "secondary" }) {
  const className = `btn btn-${variant}`;
  const content = (
    <>
      {action.icon}
      <span>{action.label}</span>
      {variant === "primary" && !action.icon && <ArrowRight className="size-3.5" />}
    </>
  );

  if ("href" in action) {
    return (
      <Link href={action.href} className={className}>
        {content}
      </Link>
    );
  }
  return (
    <button
      type="button"
      className={className}
      onClick={() => window.dispatchEvent(new CustomEvent("vac:open", { detail: { prompt: action.prompt } }))}
    >
      {content}
    </button>
  );
}

export function PortalModules() {
  return (
    <section id="modules" className="wrap sec">
      <SectionHeader
        eyebrow="Everything in one portal"
        title="Engineered for AKTU students."
        sub="Every tool runs on the official AKTU curriculum, so credits, subject codes and units match what your college follows."
        aside={
          <span style={{ display: "inline-flex", alignItems: "center", gap: "8px", fontSize: "13px", color: "var(--muted)" }}>
            <span style={{ width: "8px", height: "8px", borderRadius: "99px", background: "var(--success)" }} />
            All 9 branches live
          </span>
        }
      />

      <div className="mod-grid">
        {MODULES.map((m) => (
          <article key={m.title} className="mod">
            <div className="mod-body">
              <div className="mod-top">
                <span className="mod-ic" style={{ background: m.iconBg, color: m.iconFg }}>
                  {m.icon}
                </span>
                <span className="chip chip-o">{m.badge}</span>
              </div>
              <h3>{m.title}</h3>
              <p className="mod-d">{m.desc}</p>
              <div className="mod-tags">
                {m.tags.map((t) => (
                  <span key={t} className="chip chip-n">
                    {t}
                  </span>
                ))}
              </div>
            </div>
            <div className="mod-foot">
              <ActionButton action={m.primary} variant="primary" />
              <ActionButton action={m.secondary} variant="secondary" />
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
