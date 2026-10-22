"use client";

import { Command } from "cmdk";
import {
  Brain,
  Calculator,
  Camera,
  CalendarCheck,
  FileSearch,
  FileText,
  GraduationCap,
  Home,
  Landmark,
  LayoutDashboard,
  Library,
  Sparkles,
  TrendingUp,
  UploadCloud,
  type LucideIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const PAGES: { label: string; href: string; icon: LucideIcon; keywords?: string }[] = [
  { label: "Home", href: "/", icon: Home },
  { label: "My Dashboard", href: "/dashboard", icon: LayoutDashboard, keywords: "profile progress" },
  { label: "SGPA Calculator", href: "/sgpa", icon: Calculator, keywords: "marks grade" },
  { label: "CGPA Calculator", href: "/cgpa", icon: TrendingUp, keywords: "percentage target" },
  { label: "Resources", href: "/resources", icon: Library, keywords: "notes pyq lectures" },
  { label: "University Info", href: "/university", icon: Landmark, keywords: "aktu scholarship rules" },
  { label: "Ask your Syllabus", href: "/ask", icon: FileSearch, keywords: "syllabus pdf rag ai search chat" },
  { label: "AI Quiz", href: "/quiz", icon: Brain, keywords: "test mcq practice" },
  { label: "AI Study Planner", href: "/planner", icon: CalendarCheck, keywords: "timetable schedule exam" },
  { label: "Photo Doubt Solver", href: "/doubt", icon: Camera, keywords: "image question solve" },
  { label: "Upload notes", href: "/upload", icon: UploadCloud, keywords: "share pdf photo ocr contribute" },
];

type SearchResult = {
  subjects: { id: number; title: string; primary_code: string | null; year: number; semester: number; credits: number }[];
  resources: { id: number; subject_title: string; type: string; label: string; url: string }[];
};

/** Global Cmd+K / Ctrl+K palette. Opens on the shortcut or a "command:open" window event. */
export function CommandMenu() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult>({ subjects: [], resources: [] });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    const onOpen = () => setOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener("command:open", onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("command:open", onOpen);
    };
  }, []);

  // Debounced server search for subjects and resources
  useEffect(() => {
    if (query.trim().length < 2) {
      setResults({ subjects: [], resources: [] });
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(() => {
      fetch(`/api/search?q=${encodeURIComponent(query)}`, { signal: controller.signal })
        .then((r) => (r.ok ? r.json() : { subjects: [], resources: [] }))
        .then(setResults)
        .catch(() => {});
    }, 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  const go = (href: string) => {
    setOpen(false);
    setQuery("");
    if (href.startsWith("http")) window.open(href, "_blank", "noopener,noreferrer");
    else router.push(href);
  };

  const askVac = () => {
    setOpen(false);
    window.dispatchEvent(new CustomEvent("vac:open", { detail: { prompt: query } }));
    setQuery("");
  };

  const itemClass =
    "flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-foreground aria-selected:bg-primary/10 aria-selected:text-primary";
  const groupClass = "[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:pt-3 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground";

  return (
    <Command.Dialog
      open={open}
      onOpenChange={setOpen}
      label="Search B.Tech Hub"
      shouldFilter={true}
      overlayClassName="fixed inset-0 z-[70] bg-black/50 backdrop-blur-sm"
      contentClassName="fixed left-1/2 top-[12vh] z-[71] w-[min(92vw,640px)] -translate-x-1/2 overflow-hidden rounded-2xl border border-border bg-card shadow-2xl"
    >
      <div className="flex items-center gap-3 border-b border-border px-4">
        <Sparkles className="size-4 text-primary" aria-hidden />
        <Command.Input
          value={query}
          onValueChange={setQuery}
          placeholder="Search pages, subjects, notes... or ask Vac"
          className="h-14 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
      </div>
      <Command.List className="max-h-[60vh] overflow-y-auto p-2">
        <Command.Empty className="px-3 py-6 text-center text-sm text-muted-foreground">No matches. Press the Ask Vac option above.</Command.Empty>

        {query.trim().length > 1 && (
          <Command.Group heading="AI" className={groupClass} forceMount>
            <Command.Item value={`ask vac ${query}`} onSelect={askVac} className={itemClass} forceMount>
              <Sparkles className="size-4 text-primary" /> Ask Vac: <span className="truncate font-medium">{query}</span>
            </Command.Item>
          </Command.Group>
        )}

        <Command.Group heading="Pages" className={groupClass}>
          {PAGES.map((p) => (
            <Command.Item key={p.href} value={`${p.label} ${p.keywords ?? ""}`} onSelect={() => go(p.href)} className={itemClass}>
              <p.icon className="size-4 text-muted-foreground" /> {p.label}
            </Command.Item>
          ))}
        </Command.Group>

        {results.subjects.length > 0 && (
          <Command.Group heading="Subjects" className={groupClass} forceMount>
            {results.subjects.map((s) => (
              <Command.Item key={s.id} value={`subject ${s.title} ${s.primary_code ?? ""} ${query}`} onSelect={() => go(`/resources?year=${s.year}&q=${encodeURIComponent(s.primary_code ?? s.title)}`)} className={itemClass} forceMount>
                <GraduationCap className="size-4 text-muted-foreground" />
                <span className="truncate">{s.title}</span>
                <span className="ml-auto shrink-0 text-xs text-muted-foreground">Sem {s.semester} · {s.credits} cr</span>
              </Command.Item>
            ))}
          </Command.Group>
        )}

        {results.resources.length > 0 && (
          <Command.Group heading="Resources" className={groupClass} forceMount>
            {results.resources.map((r) => (
              <Command.Item key={r.id} value={`resource ${r.subject_title} ${r.label} ${r.type} ${query}`} onSelect={() => go(r.url)} className={itemClass} forceMount>
                <FileText className="size-4 text-muted-foreground" />
                <span className="truncate">{r.subject_title}</span>
                <span className="ml-auto shrink-0 text-xs capitalize text-muted-foreground">{r.type.replace("_", " ")} · {r.label}</span>
              </Command.Item>
            ))}
          </Command.Group>
        )}
      </Command.List>
      <div className="flex items-center justify-between border-t border-border px-4 py-2 text-[11px] text-muted-foreground">
        <span>↑↓ to move · ↵ to open · esc to close</span>
        <span>B.Tech Hub</span>
      </div>
    </Command.Dialog>
  );
}
