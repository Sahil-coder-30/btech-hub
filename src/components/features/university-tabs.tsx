"use client";

import { AnimatePresence, motion } from "motion/react";
import { ExternalLink, Sparkles } from "lucide-react";
import { useState } from "react";
import { Markdown } from "@/components/markdown";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { UniversityInfo } from "@/lib/types";
import { cn } from "@/lib/utils";

type Item = string | { name?: string; headline?: string; description?: string; details?: string; url?: string };
type DocItem = { name: string; description: string; process: string[]; link: string; linkLabel: string };
type Block = { title?: string; points?: string[]; items?: Item[]; steps?: string[] };

const list = (points: string[]) => points.map((p) => (p.startsWith("  ") ? `    ${p.trim()}` : `- ${p}`)).join("\n");

/** Renders the flexible JSON shapes stored in university_info.data. */
function Section({ data }: { data: Record<string, unknown> }) {
  const d = data as {
    content?: string;
    description?: string;
    points?: string[];
    grades?: { grade: string; point: string }[];
    items?: Item[];
    eligibility?: Block;
    documents_1?: Block;
    documents?: DocItem[];
    applicationProcess?: Block;
  };

  return (
    <div className="space-y-6">
      {(d.content || d.description) && <Markdown>{[d.content, d.description].filter(Boolean).join("\n\n")}</Markdown>}
      {d.points && <Markdown>{list(d.points)}</Markdown>}

      {d.grades && (
        <div className="overflow-hidden rounded-xl border border-border">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/60 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="p-3">Letter grade</th>
                <th className="p-3">Grade point</th>
              </tr>
            </thead>
            <tbody>
              {d.grades.map((g) => (
                <tr key={g.grade} className="border-t border-border">
                  <td className="p-3">{g.grade}</td>
                  <td className="p-3 font-semibold">{g.point}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {d.items && (
        <div className="grid gap-3 sm:grid-cols-2">
          {d.items.map((item, i) =>
            typeof item === "string" ? (
              <p key={i} className="rounded-xl border border-border p-3 text-sm">{item}</p>
            ) : (
              <div key={i} className="rounded-xl border border-border bg-background/40 p-4">
                <p className="font-semibold">{item.name ?? item.headline}</p>
                <p className="mt-1 text-sm text-muted-foreground">{item.description ?? item.details}</p>
                {item.url && (
                  <a href={item.url} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
                    Open <ExternalLink className="size-3.5" />
                  </a>
                )}
              </div>
            ),
          )}
        </div>
      )}

      {[d.eligibility, d.documents_1].filter(Boolean).map((b) => (
        <div key={b!.title}>
          <h3 className="mb-2 font-display text-lg font-semibold">{b!.title}</h3>
          <Markdown>{list(b!.points ?? (b!.items as string[]) ?? [])}</Markdown>
        </div>
      ))}

      {d.documents && (
        <div>
          <h3 className="mb-3 font-display text-lg font-semibold">How to get each document</h3>
          <div className="grid gap-4 md:grid-cols-2">
            {d.documents.map((doc) => (
              <div key={doc.name} className="rounded-xl border border-border bg-background/40 p-4">
                <p className="font-semibold">{doc.name}</p>
                <p className="mt-1 text-sm text-muted-foreground">{doc.description}</p>
                <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm">
                  {doc.process.map((p) => <li key={p}>{p}</li>)}
                </ol>
                <a href={doc.link} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
                  {doc.linkLabel} <ExternalLink className="size-3.5" />
                </a>
              </div>
            ))}
          </div>
        </div>
      )}

      {d.applicationProcess && (
        <div>
          <h3 className="mb-2 font-display text-lg font-semibold">{d.applicationProcess.title}</h3>
          <Markdown>{(d.applicationProcess.steps ?? []).map((s, i) => `${i + 1}. ${s}`).join("\n")}</Markdown>
        </div>
      )}
    </div>
  );
}

export function UniversityTabs({ sections }: { sections: UniversityInfo[] }) {
  const [active, setActive] = useState(sections[0]?.id);
  const current = sections.find((s) => s.id === active);

  return (
    <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
      <nav className="flex gap-2 overflow-x-auto pb-2 lg:flex-col lg:overflow-visible" aria-label="University info sections">
        {sections.map((s) => (
          <button
            key={s.id}
            onClick={() => setActive(s.id)}
            aria-current={active === s.id}
            className={cn(
              "shrink-0 rounded-xl px-4 py-2.5 text-left text-sm font-medium transition",
              active === s.id ? "bg-primary text-primary-foreground shadow-lg shadow-primary/30" : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            {s.title}
          </button>
        ))}
      </nav>
      <Card>
        <CardContent className="pt-6">
          <AnimatePresence mode="wait">
            {current && (
              <motion.div key={current.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
                <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                  <h2 className="font-display text-2xl font-bold">{current.title}</h2>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.dispatchEvent(new CustomEvent("vac:open", { detail: { prompt: `Explain the AKTU ${current.title} in simple words.` } }))}
                  >
                    <Sparkles className="size-4" /> Explain simply
                  </Button>
                </div>
                <Section data={current.data} />
              </motion.div>
            )}
          </AnimatePresence>
        </CardContent>
      </Card>
    </div>
  );
}
