"use client";

import { motion } from "motion/react";
import { Bookmark, BookmarkCheck, Clock, FileQuestion, FileText, PlayCircle, Search, Sparkles, Star } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label, Select } from "@/components/ui/input";
import { EmptyState, Skeleton } from "@/components/ui/misc";
import type { Branch, Resource, ResourceType } from "@/lib/types";
import { semestersForYear, toRoman, YEAR_LABELS } from "@/lib/utils";

const TYPES: { key: ResourceType; label: string; icon: typeof FileText }[] = [
  { key: "notes", label: "Notes", icon: FileText },
  { key: "pyq", label: "PYQs", icon: FileQuestion },
  { key: "lecture", label: "Lectures", icon: PlayCircle },
  { key: "imp_question", label: "Important Qs", icon: Star },
];

type Props = { branches: Branch[]; loggedIn: boolean; initial: { year: number; branch: string; q: string } };

export function ResourceBrowser({ branches, loggedIn, initial }: Props) {
  const [year, setYear] = useState(initial.year);
  const [branch, setBranch] = useState(initial.branch);
  const [semester, setSemester] = useState(0);
  const [search, setSearch] = useState(initial.q);
  const [resources, setResources] = useState<Resource[]>([]);
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState<Set<number>>(new Set());

  const ready = year === 1 || Boolean(branch);

  useEffect(() => {
    if (!loggedIn) return;
    fetch("/api/resources/save")
      .then((r) => r.json())
      .then((d) => setSaved(new Set(d.ids ?? [])))
      .catch(() => {});
  }, [loggedIn]);

  useEffect(() => {
    if (!ready) return;
    setLoading(true);
    const params = new URLSearchParams({ year: String(year) });
    if (year > 1) params.set("branch", branch);
    if (semester) params.set("semester", String(semester));
    fetch(`/api/resources?${params}`)
      .then((r) => r.json())
      .then((d) => setResources(d.resources ?? []))
      .catch(() => toast.error("Could not load resources"))
      .finally(() => setLoading(false));
  }, [year, branch, semester, ready]);

  // Group rows by subject, filtered by the search box
  const subjects = useMemo(() => {
    const q = search.trim().toLowerCase();
    const map = new Map<string, Resource[]>();
    for (const r of resources) {
      if (q && !r.subject_title.toLowerCase().includes(q) && !(r.subject_code ?? "").toLowerCase().includes(q)) continue;
      map.set(r.subject_title, [...(map.get(r.subject_title) ?? []), r]);
    }
    return [...map.entries()];
  }, [resources, search]);

  const toggleSave = async (id: number) => {
    if (!loggedIn) {
      toast("Login to bookmark resources", { action: { label: "Login", onClick: () => (window.location.href = "/login?next=/resources") } });
      return;
    }
    const res = await fetch("/api/resources/save", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ resourceId: id }) });
    if (!res.ok) return toast.error("Could not update bookmark");
    const { saved: isSaved } = await res.json();
    setSaved((prev) => {
      const next = new Set(prev);
      if (isSaved) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="grid gap-4 pt-6 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1.5">
            <Label htmlFor="r-year">Year</Label>
            <Select id="r-year" value={year} onChange={(e) => { setYear(Number(e.target.value)); setSemester(0); }}>
              {[1, 2, 3, 4].map((y) => <option key={y} value={y}>{YEAR_LABELS[y]}</option>)}
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="r-branch">Branch</Label>
            <Select id="r-branch" value={branch} disabled={year === 1} onChange={(e) => setBranch(e.target.value)}>
              <option value="">{year === 1 ? "Common for all" : "Select branch"}</option>
              {branches.map((b) => <option key={b.code} value={b.code}>{b.name}</option>)}
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="r-sem">Semester</Label>
            <Select id="r-sem" value={semester} disabled={year === 1} onChange={(e) => setSemester(Number(e.target.value))}>
              <option value={0}>Both semesters</option>
              {semestersForYear(year).map((s) => <option key={s} value={s}>Semester {toRoman(s)}</option>)}
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="r-search">Search subject</Label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input id="r-search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Name or code" className="pl-9" />
            </div>
          </div>
        </CardContent>
      </Card>

      {!ready ? (
        <EmptyState icon={Search} title="Pick your branch" description="Choose a branch to see subject resources." />
      ) : loading ? (
        <div className="grid gap-4 md:grid-cols-2">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-56 rounded-2xl" />)}</div>
      ) : subjects.length === 0 ? (
        <EmptyState icon={FileQuestion} title="No resources yet" description="Nothing uploaded for this selection. Ask Vac to explain topics meanwhile." />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {subjects.map(([title, rows], i) => (
            <motion.div key={title} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i * 0.04, 0.4) }}>
              <SubjectCard title={title} rows={rows} saved={saved} onToggleSave={toggleSave} />
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}

function SubjectCard({ title, rows, saved, onToggleSave }: { title: string; rows: Resource[]; saved: Set<number>; onToggleSave: (id: number) => void }) {
  const available = TYPES.filter((t) => rows.some((r) => r.type === t.key));
  const [tab, setTab] = useState<ResourceType>(available[0]?.key ?? "notes");
  const items = rows.filter((r) => r.type === tab);
  const ready = rows.filter((r) => r.url).length;

  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <CardTitle className="text-base leading-snug">{title}</CardTitle>
          <Badge variant={ready ? "success" : "outline"}>{ready ? `${ready} links` : "Coming soon"}</Badge>
        </div>
        <div className="flex flex-wrap gap-1.5 pt-2" role="tablist">
          {available.map((t) => (
            <button
              key={t.key}
              role="tab"
              aria-selected={tab === t.key}
              onClick={() => setTab(t.key)}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition ${tab === t.key ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"}`}
            >
              <t.icon className="size-3.5" /> {t.label}
            </button>
          ))}
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {items.map((r) =>
            r.url ? (
              <div key={r.id} className="group flex items-center rounded-xl border border-border bg-background/40 transition hover:border-primary/50">
                <a href={r.url} target="_blank" rel="noopener noreferrer" className="flex-1 truncate px-3 py-2 text-sm font-medium hover:text-primary">
                  {r.label}
                </a>
                <button onClick={() => onToggleSave(r.id)} className="px-2 text-muted-foreground hover:text-primary" aria-label={saved.has(r.id) ? `Remove ${r.label} bookmark` : `Bookmark ${r.label}`}>
                  {saved.has(r.id) ? <BookmarkCheck className="size-4 text-primary" /> : <Bookmark className="size-4" />}
                </button>
              </div>
            ) : (
              <div key={r.id} className="flex items-center gap-1.5 rounded-xl border border-dashed border-border px-3 py-2 text-sm text-muted-foreground" title="Link will be added soon">
                <Clock className="size-3.5 shrink-0" /> <span className="truncate">{r.label}</span>
                <span className="ml-auto text-[10px] uppercase">Soon</span>
              </div>
            ),
          )}
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="w-full"
          onClick={() => window.dispatchEvent(new CustomEvent("vac:open", { detail: { prompt: `Give me the most important topics and a quick revision checklist for ${title}.` } }))}
        >
          <Sparkles className="size-4" /> Quick revision with Vac
        </Button>
      </CardContent>
    </Card>
  );
}
