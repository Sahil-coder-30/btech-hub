"use client";

import Link from "next/link";
import { ArrowRight, ChevronRight, FileText, MessageSquareText, MousePointerClick } from "lucide-react";
import { useRef, useState, type KeyboardEvent } from "react";
import type { Branch } from "@/lib/types";
import { YEARS, YEAR_SHORT } from "./constants";

const STEPS = [
  { icon: FileText, title: "Official PDF, right here", text: "The AKTU syllabus opens next to the chat. Read or download it any time." },
  { icon: MessageSquareText, title: "Ask in plain words", text: "Units, topics, credits, lab lists. English or Hinglish both work." },
  { icon: MousePointerClick, title: "Check every answer", text: "Each answer cites pages. Click a citation to jump the PDF to that page." },
];

/** Arrow key support for a radiogroup of buttons (roving focus). */
function onRadioKeys<T>(e: KeyboardEvent<HTMLElement>, items: readonly T[], current: T | null, select: (item: T) => void, vertical: boolean) {
  const back = vertical ? ["ArrowUp", "ArrowLeft"] : ["ArrowLeft", "ArrowUp"];
  const forward = vertical ? ["ArrowDown", "ArrowRight"] : ["ArrowRight", "ArrowDown"];
  const step = back.includes(e.key) ? -1 : forward.includes(e.key) ? 1 : 0;
  if (!step) return;
  e.preventDefault();
  const index = current === null ? -1 : items.indexOf(current);
  const next = (index + step + items.length) % items.length;
  select(items[next]);
  const group = e.currentTarget;
  requestAnimationFrame(() => group.querySelectorAll<HTMLElement>("[role=radio]")[next]?.focus());
}

export function Picker({
  branches,
  defaultBranch,
  defaultYear,
  fromProfile,
  invalidLink,
  onOpen,
}: {
  branches: Branch[];
  defaultBranch: string | null;
  defaultYear: number | null;
  fromProfile: boolean;
  invalidLink: boolean;
  onOpen: (branch: string, year: number) => void;
}) {
  const [branch, setBranch] = useState<string | null>(defaultBranch);
  const [year, setYear] = useState<number | null>(defaultYear);
  const ctaRef = useRef<HTMLButtonElement>(null);
  const codes = branches.map((b) => b.code);
  const selected = branches.find((b) => b.code === branch);
  const ready = !!branch && !!year;

  return (
    <div className="wrap ask-picker">
      <nav className="crumb" aria-label="Breadcrumb">
        <Link href="/">Home</Link>
        <ChevronRight className="i i-s" aria-hidden />
        <span>AI Studio</span>
        <ChevronRight className="i i-s" aria-hidden />
        <span style={{ color: "var(--fg)" }}>Ask your Syllabus</span>
      </nav>

      <h1 className="ask-title">Ask your Syllabus</h1>
      <p className="ask-lead">
        Open your official AKTU syllabus and chat with it. Every answer comes from the PDF and points to the page it came from.
      </p>

      {invalidLink && (
        <div className="alert alert-w" role="status" style={{ marginTop: 20 }}>
          That link did not match a branch and year we have. Pick yours below.
        </div>
      )}

      <div className="ask-pick-grid">
        <section className="card ask-pick-card" aria-label="Choose your syllabus">
          <div className="ask-pick-h">
            <p className="eyebrow">1. Branch</p>
            {fromProfile && <span className="chip chip-n">From your profile</span>}
          </div>
          <div
            className="ask-brs"
            role="radiogroup"
            aria-label="Branch"
            onKeyDown={(e) => onRadioKeys(e, codes, branch, setBranch, true)}
          >
            {branches.map((b, i) => {
              const on = b.code === branch;
              return (
                <button
                  key={b.code}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  tabIndex={on || (!branch && i === 0) ? 0 : -1}
                  className={`br ${on ? "is-on" : ""}`}
                  onClick={() => setBranch(b.code)}
                >
                  <span className="code">{b.code}</span>
                  <span className="ask-br-name">{b.name}</span>
                </button>
              );
            })}
          </div>

          <p className="eyebrow" style={{ marginTop: 22, marginBottom: 10 }}>
            2. Year
          </p>
          <div className="seg" role="radiogroup" aria-label="Year" onKeyDown={(e) => onRadioKeys(e, YEARS, year as (typeof YEARS)[number] | null, setYear, false)}>
            {YEARS.map((y, i) => {
              const on = y === year;
              return (
                <button
                  key={y}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  tabIndex={on || (!year && i === 0) ? 0 : -1}
                  className={`seg-b ${on ? "is-on" : ""}`}
                  onClick={() => {
                    setYear(y);
                    if (branch) ctaRef.current?.focus();
                  }}
                >
                  {YEAR_SHORT[y]}
                </button>
              );
            })}
          </div>

          <div className="ask-pick-foot">
            <p className="hint" aria-live="polite">
              {ready && selected ? (
                <>
                  <strong style={{ color: "var(--fg)", fontWeight: 600 }}>{selected.code}</strong> · {YEAR_SHORT[year!]} · official AKTU PDF
                </>
              ) : (
                "Pick a branch and a year to continue."
              )}
            </p>
            <button ref={ctaRef} type="button" className="btn btn-primary" disabled={!ready} onClick={() => ready && onOpen(branch!, year!)}>
              Open syllabus
              <ArrowRight className="i i-s" aria-hidden />
            </button>
          </div>
        </section>

        <aside className="card ask-how" aria-label="How it works">
          <p className="eyebrow">How it works</p>
          <ol>
            {STEPS.map((s) => (
              <li key={s.title}>
                <span className="menu-ic">
                  <s.icon className="i" aria-hidden />
                </span>
                <span>
                  <span className="ask-how-t">{s.title}</span>
                  <span className="ask-how-d">{s.text}</span>
                </span>
              </li>
            ))}
          </ol>
        </aside>
      </div>
    </div>
  );
}
