"use client";

import { Brain, Heart, Lightbulb, Pin, Target, Trash2, TrendingUp, Zap, type LucideIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/misc";
import type { MemoryKind, StudentMemory } from "@/lib/types";
import { formatDate } from "@/lib/utils";

const KINDS: { kind: MemoryKind; label: string; icon: LucideIcon }[] = [
  { kind: "goal", label: "Goals", icon: Target },
  { kind: "struggle", label: "Struggles", icon: Zap },
  { kind: "strength", label: "Strengths", icon: TrendingUp },
  { kind: "preference", label: "Preferences", icon: Heart },
  { kind: "fact", label: "Facts", icon: Pin },
  { kind: "event", label: "Events", icon: Lightbulb },
];

const SOURCE_LABELS: Record<StudentMemory["source"], string> = { onboarding: "From onboarding", chat: "From chat", quiz: "From a quiz", manual: "Added by you" };

export function MemoryManager({ initial }: { initial: StudentMemory[] }) {
  const [memories, setMemories] = useState(initial);
  const [busy, setBusy] = useState<string | null>(null);

  const remove = async (id: string) => {
    setBusy(id);
    const res = await fetch(`/api/memory/${id}`, { method: "DELETE" }).catch(() => null);
    setBusy(null);
    if (!res?.ok) return toast.error("Could not delete. Please try again.");
    setMemories((m) => m.filter((x) => x.id !== id));
  };

  const clearAll = async () => {
    if (!window.confirm("Delete everything Vac remembers about you? This cannot be undone.")) return;
    setBusy("all");
    const res = await fetch("/api/memory", { method: "DELETE" }).catch(() => null);
    setBusy(null);
    if (!res?.ok) return toast.error("Could not delete. Please try again.");
    setMemories([]);
    toast.success("Vac's memory is cleared.");
  };

  if (!memories.length) {
    return (
      <EmptyState
        className="mt-8"
        icon={Brain}
        title="Vac doesn't remember anything yet"
        description="Tell Vac about your goals, exam dates or what you find hard, and it will keep short notes here."
        action={
          <Button size="sm" onClick={() => window.dispatchEvent(new CustomEvent("vac:open", { detail: { prompt: "Here are my goals for this semester: " } }))}>
            Talk to Vac
          </Button>
        }
      />
    );
  }

  return (
    <div className="mt-8 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">{memories.length} saved notes. Deleted notes are gone for good and Vac will not see them again.</p>
        <Button variant="outline" size="sm" onClick={clearAll} disabled={busy !== null}>
          <Trash2 /> Forget everything
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {KINDS.map(({ kind, label, icon: Icon }) => {
          const items = memories.filter((m) => m.kind === kind);
          if (!items.length) return null;
          return (
            <Card key={kind}>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Icon className="size-4 text-primary" /> {label}
                  <Badge variant="secondary">{items.length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="divide-y divide-border">
                  {items.map((m) => (
                    <li key={m.id} className="flex items-start justify-between gap-3 py-3 text-sm">
                      <div className="min-w-0">
                        <p>{m.content}</p>
                        <p className="text-xs text-muted-foreground">{SOURCE_LABELS[m.source]} · {formatDate(m.updated_at)}</p>
                      </div>
                      <Button variant="ghost" size="icon" aria-label="Delete this memory" onClick={() => remove(m.id)} disabled={busy !== null} className="size-8 shrink-0">
                        <Trash2 />
                      </Button>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
