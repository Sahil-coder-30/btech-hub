"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { Brain, BrainCircuit, Pin, Search, SearchX, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { IconBadge, Meter } from "@/components/dashboard/ui";
import type { MemoryKind, StudentMemory } from "@/lib/types";
import { cn } from "@/lib/utils";
import { AddMemoryForm, MemoryEmptyState } from "./memory-add";
import { ConfirmDialog } from "./memory-dialog";
import { KIND_META, KIND_ORDER, MemoryItem } from "./memory-item";
import { usePreferences } from "./preferences-context";
import { SettingsHeader } from "./primitives";

const UNDO_MS = 5000;

type Result<T> = { ok: true; data: T } | { ok: false; status: number; error: string };

/** fetch + JSON with the server's { error } message on failure. */
async function call<T>(url: string, init?: RequestInit): Promise<Result<T>> {
  const res = await fetch(url, { ...init, headers: init?.body ? { "Content-Type": "application/json" } : undefined }).catch(() => null);
  if (!res) return { ok: false, status: 0, error: "Check your connection and try again." };
  const body = (await res.json().catch(() => null)) as (T & { error?: string }) | null;
  if (!res.ok) return { ok: false, status: res.status, error: body?.error ?? "Something went wrong. Please try again." };
  return { ok: true, data: body as T };
}

// Rows from before the pinned column existed have no flag
const normalize = (memory: StudentMemory): StudentMemory => ({ ...memory, pinned: Boolean(memory.pinned) });

type PendingDelete = { memory: StudentMemory; index: number; timer: ReturnType<typeof setTimeout>; toastId: string | number };

/** Everything on /settings/memory: limit meter, add form, search, filters and the list. */
export function MemoryManager({ initial, limit, now }: { initial: StudentMemory[]; limit: number; now: number }) {
  const { preferences, update } = usePreferences();
  const [memories, setMemories] = useState(() => initial.map(normalize));
  const [query, setQuery] = useState("");
  const [kindFilter, setKindFilter] = useState<MemoryKind | "all">("all");
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [clearOpen, setClearOpen] = useState(false);
  const [keepPinned, setKeepPinned] = useState(true);
  const [clearing, setClearing] = useState(false);
  const [announcement, setAnnouncement] = useState("");

  const searchRef = useRef<HTMLInputElement>(null);
  const pending = useRef(new Map<string, PendingDelete>());
  // Selector to focus after the next render, so keyboard users never lose their place
  const focusNext = useRef<string | null>(null);
  const highlightTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const announce = useCallback((message: string) => {
    // Clear first so the same message is read again
    setAnnouncement("");
    requestAnimationFrame(() => setAnnouncement(message));
  }, []);

  useEffect(() => {
    if (!focusNext.current) return;
    const selector = focusNext.current;
    focusNext.current = null;
    requestAnimationFrame(() => {
      const el = document.querySelector<HTMLElement>(selector);
      (el ?? searchRef.current)?.focus();
    });
  });

  const flash = useCallback((id: string) => {
    setHighlightId(id);
    if (highlightTimer.current) clearTimeout(highlightTimer.current);
    highlightTimer.current = setTimeout(() => setHighlightId(null), 2400);
    requestAnimationFrame(() => document.querySelector(`[data-memory-id="${id}"]`)?.scrollIntoView({ block: "nearest" }));
  }, []);

  // A delete waiting for its undo window is sent right away when the student leaves
  useEffect(() => {
    const map = pending.current;
    const flush = () => {
      for (const [id, entry] of map) {
        clearTimeout(entry.timer);
        toast.dismiss(entry.toastId);
        void fetch(`/api/memory/${id}`, { method: "DELETE", keepalive: true }).catch(() => null);
      }
      map.clear();
    };
    window.addEventListener("pagehide", flush);
    return () => {
      window.removeEventListener("pagehide", flush);
      flush();
    };
  }, []);

  // "/" jumps to search, like most list pages
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "/" || event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable=true], dialog[open]")) return;
      if (!searchRef.current) return;
      event.preventDefault();
      searchRef.current.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // ---------- Derived lists ----------

  const searched = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? memories.filter((m) => m.content.toLowerCase().includes(q) || KIND_META[m.kind].label.toLowerCase().includes(q)) : memories;
  }, [memories, query]);

  const counts = useMemo(() => {
    const map = Object.fromEntries(KIND_ORDER.map((kind) => [kind, 0])) as Record<MemoryKind, number>;
    for (const m of searched) map[m.kind] += 1;
    return map;
  }, [searched]);

  const visible = kindFilter === "all" ? searched : searched.filter((m) => m.kind === kindFilter);
  const pinned = visible.filter((m) => m.pinned);
  const others = visible.filter((m) => !m.pinned);
  const pinnedTotal = memories.filter((m) => m.pinned).length;
  const filtering = query.trim() !== "" || kindFilter !== "all";
  const full = memories.length >= limit;
  const pct = limit ? (memories.length / limit) * 100 : 0;

  // ---------- Actions ----------

  const patchLocal = (id: string, patch: Partial<StudentMemory>) => setMemories((list) => list.map((m) => (m.id === id ? { ...m, ...patch } : m)));

  const togglePin = async (memory: StudentMemory) => {
    const next = !memory.pinned;
    patchLocal(memory.id, { pinned: next });
    focusNext.current = `[data-memory-pin="${memory.id}"]`;
    announce(next ? "Pinned. Vac will always keep this memory." : "Unpinned.");

    const result = await call<{ memory: StudentMemory }>(`/api/memory/${memory.id}`, { method: "PATCH", body: JSON.stringify({ pinned: next }) });
    if (result.ok) {
      patchLocal(memory.id, { pinned: Boolean(result.data.memory?.pinned ?? next), updated_at: result.data.memory?.updated_at ?? memory.updated_at });
      return;
    }
    patchLocal(memory.id, { pinned: memory.pinned });
    toast.error(next ? "Could not pin that memory" : "Could not unpin that memory", { description: result.error });
    announce("Change not saved.");
  };

  const saveEdit = async (memory: StudentMemory, patch: { kind: MemoryKind; content: string }) => {
    patchLocal(memory.id, { ...patch, updated_at: new Date().toISOString() });
    announce("Memory updated.");
    const result = await call<{ memory: StudentMemory }>(`/api/memory/${memory.id}`, { method: "PATCH", body: JSON.stringify(patch) });
    if (result.ok) {
      if (result.data.memory) patchLocal(memory.id, normalize(result.data.memory));
      return true;
    }
    patchLocal(memory.id, { kind: memory.kind, content: memory.content, updated_at: memory.updated_at });
    toast.error("Could not save your edit", { description: result.error });
    announce("Edit not saved.");
    return false;
  };

  const restore = (entry: PendingDelete) =>
    setMemories((list) => {
      if (list.some((m) => m.id === entry.memory.id)) return list;
      const copy = [...list];
      copy.splice(Math.min(entry.index, copy.length), 0, entry.memory);
      return copy;
    });

  const commitDelete = async (id: string) => {
    const entry = pending.current.get(id);
    if (!entry) return;
    pending.current.delete(id);
    toast.dismiss(entry.toastId);
    const result = await call<{ ok: true }>(`/api/memory/${id}`, { method: "DELETE" });
    // 404 means it is already gone (for example after Clear all), which is what we wanted
    if (result.ok || result.status === 404) return;
    restore(entry);
    toast.error("Could not delete that memory", { description: result.error });
    announce("Delete failed. The memory is back in your list.");
  };

  const undoDelete = (id: string) => {
    const entry = pending.current.get(id);
    if (!entry) return;
    clearTimeout(entry.timer);
    pending.current.delete(id);
    restore(entry);
    focusNext.current = `[data-memory-pin="${id}"]`;
    flash(id);
    announce("Memory restored.");
  };

  const remove = (memory: StudentMemory) => {
    // Keep focus in the list: move to the neighbour that takes this row's place
    const order = [...pinned, ...others].map((m) => m.id);
    const at = order.indexOf(memory.id);
    const neighbour = order[at + 1] ?? order[at - 1];
    focusNext.current = neighbour ? `[data-memory-pin="${neighbour}"]` : null;

    const index = memories.findIndex((m) => m.id === memory.id);
    setMemories((list) => list.filter((m) => m.id !== memory.id));

    const preview = memory.content.length > 60 ? `${memory.content.slice(0, 57)}...` : memory.content;
    const toastId = toast("Memory deleted", {
      description: preview,
      duration: UNDO_MS,
      action: { label: "Undo", onClick: () => undoDelete(memory.id) },
    });
    const timer = setTimeout(() => void commitDelete(memory.id), UNDO_MS);
    pending.current.set(memory.id, { memory, index, timer, toastId });
    announce("Memory deleted. Press Undo in the notification within 5 seconds to bring it back.");
  };

  const add = async (kind: MemoryKind, content: string) => {
    const result = await call<{ memory: StudentMemory; status: "saved" | "duplicate" }>("/api/memory", {
      method: "POST",
      body: JSON.stringify({ kind, content }),
    });
    if (!result.ok) {
      toast.error("Could not save that memory", { description: result.error });
      return false;
    }
    const { memory, status } = result.data;
    if (status === "duplicate") {
      toast.info("Vac already remembers this", { description: "We highlighted it in your list." });
      if (memory?.id && memories.some((m) => m.id === memory.id)) {
        setQuery("");
        setKindFilter("all");
        flash(memory.id);
      }
      announce("You already have this memory.");
      return true;
    }

    if (full) {
      // The server made room by dropping an old memory, so take its list as the truth
      const fresh = await call<{ memories: StudentMemory[] }>("/api/memory");
      if (fresh.ok) setMemories(fresh.data.memories.map(normalize));
    } else if (memory) {
      setMemories((list) => {
        const firstUnpinned = list.findIndex((m) => !m.pinned);
        const copy = [...list];
        copy.splice(firstUnpinned === -1 ? copy.length : firstUnpinned, 0, normalize(memory));
        return copy;
      });
    }
    if (memory?.id) flash(memory.id);
    toast.success("Memory saved", { description: "Vac will keep this in mind from your next message." });
    announce("Memory saved.");
    return true;
  };

  const clearAll = async () => {
    const keep = keepPinned && pinnedTotal > 0;
    setClearing(true);
    const result = await call<{ ok: true; deleted?: number }>(keep ? "/api/memory?keepPinned=1" : "/api/memory", { method: "DELETE" });
    setClearing(false);
    if (!result.ok) {
      toast.error("Could not clear your memory", { description: result.error });
      return;
    }
    const expected = keep ? memories.length - pinnedTotal : memories.length;
    const deleted = result.data.deleted ?? expected;
    setMemories((list) => (keep ? list.filter((m) => m.pinned) : []));
    setClearOpen(false);
    setQuery("");
    setKindFilter("all");
    const message = `${deleted} ${deleted === 1 ? "memory" : "memories"} deleted${keep ? ", pinned ones kept" : ""}.`;
    toast.success("Memory cleared", { description: message });
    announce(message);
  };

  // ---------- Render ----------

  const renderList = (items: StudentMemory[]) => (
    <ul className="space-y-2">
      <AnimatePresence initial={false} mode="popLayout">
        {items.map((memory) => (
          <motion.li
            key={memory.id}
            layout="position"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
          >
            <MemoryItem memory={memory} now={now} query={query} highlighted={highlightId === memory.id} onTogglePin={togglePin} onSave={saveEdit} onDelete={remove} />
          </motion.li>
        ))}
      </AnimatePresence>
    </ul>
  );

  const deleteCount = keepPinned && pinnedTotal > 0 ? memories.length - pinnedTotal : memories.length;

  return (
    <>
      <SettingsHeader
        title="Memory"
        description="Short notes Vac keeps about you so its help fits. Pin what matters, edit what changed, delete anything."
        action={
          memories.length > 0 ? (
            <button
              type="button"
              className="btn btn-ghost btn-sm text-[var(--danger)] hover:bg-[var(--danger-soft)] hover:text-[var(--danger)]"
              onClick={() => {
                setKeepPinned(true);
                setClearOpen(true);
              }}
            >
              <Trash2 className="size-4" aria-hidden /> Clear all
            </button>
          ) : undefined
        }
      />

      <p aria-live="polite" role="status" className="sr-only">
        {announcement}
      </p>

      <div className="space-y-5">
        <MemoryBanners
          memoryEnabled={preferences.vac.memoryEnabled}
          useProfile={preferences.vac.useProfile}
          onEnableMemory={() => void update({ vac: { memoryEnabled: true } })}
          onEnableProfile={() => void update({ vac: { useProfile: true } })}
        />

        <section aria-labelledby="memory-usage" className="rounded-2xl border border-border bg-card shadow-[var(--shadow)]">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-3 px-5 pt-5">
            <IconBadge icon={Brain} accent="violet" size="sm" />
            <div className="min-w-0 flex-1">
              <h2 id="memory-usage" className="text-[15px] font-semibold tracking-tight">
                <span className="font-mono tabular-nums">{memories.length}</span>
                <span className="text-muted-foreground"> of {limit} memories</span>
              </h2>
              <p className="mt-0.5 text-[13px] text-muted-foreground">Pinned memories are never dropped. When full, the oldest unpinned one makes room.</p>
            </div>
            {pinnedTotal > 0 && (
              <span className="chip chip-p">
                <Pin className="size-3" aria-hidden /> {pinnedTotal} pinned
              </span>
            )}
          </div>
          <div className="px-5 pt-3">
            <Meter value={pct} accent={pct >= 100 ? "rose" : pct >= 80 ? "amber" : "violet"} />
          </div>
          <div className="mt-5 border-t border-border px-5 py-4">
            <AddMemoryForm onAdd={add} full={full} />
          </div>
        </section>

        {memories.length === 0 ? (
          <MemoryEmptyState onAdd={add} />
        ) : (
          <section aria-label="Your memories" className="rounded-2xl border border-border bg-card p-4 shadow-[var(--shadow)] sm:p-5">
            <div className="flex flex-col gap-3">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                <label htmlFor="memory-search" className="sr-only">
                  Search memories
                </label>
                <input
                  id="memory-search"
                  ref={searchRef}
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Escape" && query) {
                      event.preventDefault();
                      setQuery("");
                    }
                  }}
                  placeholder="Search memories"
                  autoComplete="off"
                  className="input pl-9 pr-10"
                />
                {!query && <span className="kbd pointer-events-none absolute right-2.5 top-1/2 hidden -translate-y-1/2 font-mono text-[11px] text-muted-foreground sm:inline-grid">/</span>}
              </div>

              <div role="group" aria-label="Filter by kind" className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-0.5 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0">
                <FilterChip active={kindFilter === "all"} onClick={() => setKindFilter("all")} label="All" count={searched.length} />
                {KIND_ORDER.filter((kind) => counts[kind] > 0 || kindFilter === kind).map((kind) => (
                  <FilterChip key={kind} active={kindFilter === kind} onClick={() => setKindFilter(kindFilter === kind ? "all" : kind)} label={KIND_META[kind].plural} count={counts[kind]} />
                ))}
              </div>
              <p aria-live="polite" className="text-xs text-muted-foreground">
                {filtering ? `Showing ${visible.length} of ${memories.length}` : `${memories.length} ${memories.length === 1 ? "memory" : "memories"}, newest first`}
              </p>
            </div>

            {visible.length === 0 ? (
              <div className="mt-4 flex flex-col items-center gap-2 rounded-xl border border-dashed border-border px-4 py-10 text-center">
                <SearchX className="size-6 text-muted-foreground" aria-hidden />
                <p className="text-sm font-medium">No memories match{query.trim() ? ` "${query.trim()}"` : " this filter"}</p>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm mt-1"
                  onClick={() => {
                    setQuery("");
                    setKindFilter("all");
                    searchRef.current?.focus();
                  }}
                >
                  Clear filters
                </button>
              </div>
            ) : (
              <div className="mt-4 space-y-5">
                {pinned.length > 0 && (
                  <div>
                    <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                      <Pin className="size-3.5 text-primary" aria-hidden /> Pinned
                      <span className="font-mono tabular-nums">{pinned.length}</span>
                    </h3>
                    {renderList(pinned)}
                  </div>
                )}
                {others.length > 0 && (
                  <div>
                    {pinned.length > 0 && (
                      <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                        <BrainCircuit className="size-3.5" aria-hidden /> Everything else
                        <span className="font-mono tabular-nums">{others.length}</span>
                      </h3>
                    )}
                    {renderList(others)}
                  </div>
                )}
              </div>
            )}
          </section>
        )}
      </div>

      <ConfirmDialog
        open={clearOpen}
        onClose={() => setClearOpen(false)}
        onConfirm={() => void clearAll()}
        busy={clearing}
        tone="danger"
        title="Clear Vac's memory?"
        description="Vac will forget these notes right away. This cannot be undone."
        confirmLabel={deleteCount === 0 ? "Nothing to delete" : `Delete ${deleteCount} ${deleteCount === 1 ? "memory" : "memories"}`}
      >
        {pinnedTotal > 0 && (
          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-border bg-[var(--surface-2)] p-3 text-sm">
            <input type="checkbox" checked={keepPinned} onChange={(event) => setKeepPinned(event.target.checked)} className="mt-0.5 size-4 accent-[var(--primary)]" />
            <span>
              <span className="font-medium">Keep pinned memories</span>
              <span className="block text-xs text-muted-foreground">
                {pinnedTotal} pinned {pinnedTotal === 1 ? "memory stays" : "memories stay"} safe.
              </span>
            </span>
          </label>
        )}
      </ConfirmDialog>
    </>
  );
}

function FilterChip({ active, onClick, label, count }: { active: boolean; onClick: () => void; label: string; count: number }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg border px-3 text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[var(--ring)]",
        active ? "border-transparent bg-[var(--fg)] text-[var(--bg)]" : "border-border bg-card text-muted-foreground hover:bg-[var(--surface-2)] hover:text-foreground",
      )}
    >
      {label}
      <span className={cn("font-mono text-[11px] tabular-nums", active ? "opacity-70" : "opacity-80")}>{count}</span>
    </button>
  );
}

/** Explains when a Vac setting changes what memory does, with a one-click fix. */
function MemoryBanners({
  memoryEnabled,
  useProfile,
  onEnableMemory,
  onEnableProfile,
}: {
  memoryEnabled: boolean;
  useProfile: boolean;
  onEnableMemory: () => void;
  onEnableProfile: () => void;
}) {
  if (memoryEnabled && useProfile) return null;
  return (
    <div className="space-y-2">
      {!useProfile && (
        <Banner
          title="Vac is not using your memory right now"
          text={
            <>
              Use my profile and memory is off in{" "}
              <Link href="/settings/vac" className="link">
                Vac AI settings
              </Link>
              , so every chat starts fresh.
            </>
          }
          actionLabel="Turn on"
          onAction={onEnableProfile}
        />
      )}
      {!memoryEnabled && <Banner title="Vac is not saving new memories" text="It still uses the ones below. You can always add notes yourself." actionLabel="Turn back on" onAction={onEnableMemory} />}
    </div>
  );
}

function Banner({ title, text, actionLabel, onAction }: { title: string; text: React.ReactNode; actionLabel: string; onAction: () => void }) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-[color-mix(in_oklab,var(--warning)_35%,var(--border))] bg-[var(--warning-soft)] px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0 text-sm">
        <p className="font-medium text-[var(--warning)]">{title}</p>
        <p className="mt-0.5 text-[13px] text-[var(--fg-2)]">{text}</p>
      </div>
      <button type="button" className="btn btn-secondary btn-sm shrink-0" onClick={onAction}>
        {actionLabel}
      </button>
    </div>
  );
}
