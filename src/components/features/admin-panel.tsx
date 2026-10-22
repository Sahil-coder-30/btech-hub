"use client";

import { BarChart3, Database, FileUp, Library, Link2, Mail, Plus, RefreshCw, Save, Trash2, TriangleAlert } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label, Select } from "@/components/ui/input";
import { Spinner } from "@/components/ui/misc";
import type { Branch, Resource, SyllabusLink } from "@/lib/types";
import { cn, formatDate, YEAR_LABELS } from "@/lib/utils";

type Tab = "overview" | "resources" | "knowledge";
type Doc = { id: string; title: string; status: string; chunk_count: number; error: string | null; created_at: string; branch_code: string | null; year: number | null };

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Request failed");
  return data;
}

export function AdminPanel({ branches, syllabus, pineconeReady }: { branches: Branch[]; syllabus: SyllabusLink[]; pineconeReady: boolean }) {
  const [tab, setTab] = useState<Tab>("overview");
  const tabs: { key: Tab; label: string; icon: typeof BarChart3 }[] = [
    { key: "overview", label: "Overview", icon: BarChart3 },
    { key: "resources", label: "Resources", icon: Library },
    { key: "knowledge", label: "AI Knowledge Base", icon: Database },
  ];

  return (
    <div className="space-y-6">
      <div className="flex gap-2 overflow-x-auto" role="tablist">
        {tabs.map((t) => (
          <button
            key={t.key}
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => setTab(t.key)}
            className={cn("inline-flex shrink-0 items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition", tab === t.key ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted")}
          >
            <t.icon className="size-4" /> {t.label}
          </button>
        ))}
      </div>
      {tab === "overview" && <Overview />}
      {tab === "resources" && <Resources branches={branches} />}
      {tab === "knowledge" && <Knowledge branches={branches} syllabus={syllabus} pineconeReady={pineconeReady} />}
    </div>
  );
}

// ---------- Overview ----------

function Overview() {
  const [data, setData] = useState<{ stats: Record<string, number>; messages: { id: string; name: string; email: string; message: string; created_at: string }[] } | null>(null);

  useEffect(() => {
    api<typeof data>("/api/admin/stats").then(setData).catch((e) => toast.error(e.message));
  }, []);

  if (!data) return <div className="grid place-items-center py-20"><Spinner size={28} /></div>;
  const labels: Record<string, string> = {
    visitors: "Visitors", users: "Users", chats: "Vac questions", quizzes: "Quizzes", plans: "Study plans", doubts: "Doubts solved", resources: "Resource slots", missing: "Coming soon links", documents: "Indexed docs",
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
        {Object.entries(labels).map(([k, label]) => (
          <Card key={k}>
            <CardContent className="pt-5">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
              <p className="font-display text-3xl font-bold">{(data.stats[k] ?? 0).toLocaleString("en-IN")}</p>
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Mail className="size-5 text-primary" /> Contact messages</CardTitle></CardHeader>
        <CardContent>
          {data.messages.length ? (
            <ul className="divide-y divide-border">
              {data.messages.map((m) => (
                <li key={m.id} className="space-y-1 py-3 text-sm">
                  <p className="flex flex-wrap items-center gap-2 font-medium">
                    {m.name} <a href={`mailto:${m.email}`} className="text-xs text-primary hover:underline">{m.email}</a>
                    <span className="ml-auto text-xs text-muted-foreground">{formatDate(m.created_at)}</span>
                  </p>
                  <p className="whitespace-pre-wrap text-muted-foreground">{m.message}</p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No messages yet.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ---------- Resources ----------

const EMPTY = { subject_title: "", subject_code: "", year: 1, semester: 1, branch_code: "", type: "notes", label: "", url: "" };

function Resources({ branches }: { branches: Branch[] }) {
  const [filters, setFilters] = useState({ year: "1", branch: "", q: "", missing: true });
  const [rows, setRows] = useState<Resource[]>([]);
  const [loading, setLoading] = useState(false);
  const [edits, setEdits] = useState<Record<number, string>>({});
  const [form, setForm] = useState(EMPTY);

  const load = useCallback(async () => {
    setLoading(true);
    const p = new URLSearchParams({ year: filters.year, q: filters.q, missing: filters.missing ? "1" : "0" });
    if (filters.branch) p.set("branch", filters.branch);
    try {
      const data = await api<{ resources: Resource[] }>(`/api/admin/resources?${p}`);
      setRows(data.resources);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    load();
  }, [load]);

  const saveUrl = async (id: number) => {
    try {
      await api("/api/admin/resources", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, url: edits[id] || null }) });
      toast.success("Link saved");
      setRows((r) => r.map((x) => (x.id === id ? { ...x, url: edits[id] || null } : x)));
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const remove = async (id: number) => {
    if (!confirm("Delete this resource row?")) return;
    try {
      await api(`/api/admin/resources?id=${id}`, { method: "DELETE" });
      setRows((r) => r.filter((x) => x.id !== id));
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const add = async () => {
    try {
      await api("/api/admin/resources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, subject_code: form.subject_code || null, branch_code: form.branch_code || null, url: form.url || null }),
      });
      toast.success("Resource added");
      setForm(EMPTY);
      load();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Plus className="size-5 text-primary" /> Add resource</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Input placeholder="Subject title, e.g. Data Structure (BCS301)" value={form.subject_title} onChange={(e) => setForm({ ...form, subject_title: e.target.value })} className="lg:col-span-2" aria-label="Subject title" />
          <Input placeholder="Code, e.g. BCS301" value={form.subject_code} onChange={(e) => setForm({ ...form, subject_code: e.target.value })} aria-label="Subject code" />
          <Select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} aria-label="Type">
            <option value="notes">Notes</option><option value="pyq">PYQ</option><option value="lecture">Lecture</option><option value="imp_question">Important question</option><option value="other">Other</option>
          </Select>
          <Select value={form.year} onChange={(e) => setForm({ ...form, year: Number(e.target.value) })} aria-label="Year">
            {[1, 2, 3, 4].map((y) => <option key={y} value={y}>{YEAR_LABELS[y]}</option>)}
          </Select>
          <Input type="number" min={1} max={8} value={form.semester} onChange={(e) => setForm({ ...form, semester: Number(e.target.value) })} aria-label="Semester" />
          <Select value={form.branch_code} onChange={(e) => setForm({ ...form, branch_code: e.target.value })} aria-label="Branch">
            <option value="">Common (1st year)</option>
            {branches.map((b) => <option key={b.code} value={b.code}>{b.code}</option>)}
          </Select>
          <Input placeholder="Label, e.g. Unit 1" value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} aria-label="Label" />
          <Input placeholder="https://... (empty = coming soon)" value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} className="sm:col-span-2 lg:col-span-3" aria-label="URL" />
          <Button onClick={add} disabled={!form.subject_title || !form.label}>Add</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Manage resources</CardTitle>
          <CardDescription>Paste a link next to any "coming soon" slot and save. Showing up to 300 rows.</CardDescription>
          <div className="grid gap-3 pt-3 sm:grid-cols-4">
            <Select value={filters.year} onChange={(e) => setFilters({ ...filters, year: e.target.value })} aria-label="Filter year">
              {[1, 2, 3, 4].map((y) => <option key={y} value={y}>{YEAR_LABELS[y]}</option>)}
            </Select>
            <Select value={filters.branch} onChange={(e) => setFilters({ ...filters, branch: e.target.value })} aria-label="Filter branch">
              <option value="">All branches</option>
              {branches.map((b) => <option key={b.code} value={b.code}>{b.code}</option>)}
            </Select>
            <Input placeholder="Search subject" value={filters.q} onChange={(e) => setFilters({ ...filters, q: e.target.value })} aria-label="Search subject" />
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={filters.missing} onChange={(e) => setFilters({ ...filters, missing: e.target.checked })} className="size-4 accent-[var(--primary)]" />
              Only coming soon
            </label>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="grid place-items-center py-10"><Spinner /></div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead className="text-xs uppercase text-muted-foreground">
                  <tr className="border-b border-border">
                    <th className="p-2">Subject</th><th className="p-2">Type</th><th className="p-2">Label</th><th className="p-2">Link</th><th className="p-2" />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id} className="border-b border-border/60">
                      <td className="max-w-64 truncate p-2" title={r.subject_title}>{r.subject_title}<span className="block text-xs text-muted-foreground">{r.branch_code ?? "Common"} · Sem {r.semester}</span></td>
                      <td className="p-2 capitalize">{r.type.replace("_", " ")}</td>
                      <td className="p-2">{r.label}</td>
                      <td className="p-2">
                        <div className="flex gap-2">
                          <Input
                            defaultValue={r.url ?? ""}
                            placeholder="Coming soon"
                            onChange={(e) => setEdits({ ...edits, [r.id]: e.target.value })}
                            className="h-8 min-w-56 text-xs"
                            aria-label={`Link for ${r.subject_title} ${r.label}`}
                          />
                          <Button size="icon" variant="ghost" onClick={() => saveUrl(r.id)} disabled={edits[r.id] === undefined} aria-label="Save link"><Save className="size-4" /></Button>
                        </div>
                      </td>
                      <td className="p-2"><Button size="icon" variant="ghost" onClick={() => remove(r.id)} aria-label="Delete"><Trash2 className="size-4 text-danger" /></Button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!rows.length && <p className="py-8 text-center text-sm text-muted-foreground">No rows for this filter.</p>}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ---------- Knowledge base (Pinecone) ----------

function Knowledge({ branches, syllabus, pineconeReady }: { branches: Branch[]; syllabus: SyllabusLink[]; pineconeReady: boolean }) {
  const [docs, setDocs] = useState<Doc[]>([]);
  const [links, setLinks] = useState(syllabus);
  const [busy, setBusy] = useState<string | null>(null);
  const [form, setForm] = useState({ title: "", url: "", subject_code: "", branch_code: "", year: "" });
  const [file, setFile] = useState<File | null>(null);

  const load = useCallback(() => {
    api<{ documents: Doc[] }>("/api/admin/documents").then((d) => setDocs(d.documents)).catch((e) => toast.error(e.message));
  }, []);
  useEffect(load, [load]);

  const upload = async () => {
    const body = new FormData();
    Object.entries(form).forEach(([k, v]) => v && body.set(k, v));
    if (file) body.set("file", file);
    setBusy("upload");
    try {
      const res = await api<{ chunks: number }>("/api/admin/documents", { method: "POST", body });
      toast.success(`Indexed ${res.chunks} chunks into Pinecone`);
      setForm({ title: "", url: "", subject_code: "", branch_code: "", year: "" });
      setFile(null);
      load();
    } catch (e) {
      toast.error((e as Error).message);
      load();
    } finally {
      setBusy(null);
    }
  };

  const indexSyllabus = async (link: SyllabusLink) => {
    setBusy(`s-${link.id}`);
    try {
      const res = await api<{ chunks: number }>("/api/admin/syllabus-index", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: link.id }) });
      toast.success(`${link.branch_code} Y${link.year}: ${res.chunks} chunks indexed`);
      setLinks((l) => l.map((x) => (x.id === link.id ? { ...x, indexed_at: new Date().toISOString() } : x)));
      load();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const remove = async (id: string) => {
    if (!confirm("Remove this document and its vectors?")) return;
    try {
      await api(`/api/admin/documents?id=${id}`, { method: "DELETE" });
      setDocs((d) => d.filter((x) => x.id !== id));
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <div className="space-y-6">
      {!pineconeReady && (
        <p className="flex items-center gap-2 rounded-xl bg-warning/10 p-4 text-sm text-warning" role="alert">
          <TriangleAlert className="size-4 shrink-0" /> Pinecone is not configured. Add PINECONE_API_KEY and PINECONE_INDEX in .env.local, then restart the server.
        </p>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Link2 className="size-5 text-primary" /> Official syllabus PDFs</CardTitle>
          <CardDescription>One click pulls the Drive PDF, splits it, embeds it with Gemini and stores vectors in Pinecone. Drive files must be public.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {links.map((l) => (
              <div key={l.id} className="flex items-center justify-between gap-2 rounded-xl border border-border px-3 py-2 text-sm">
                <span>{l.branch_code} · Year {l.year}</span>
                {l.indexed_at ? <Badge variant="success">Indexed</Badge> : null}
                <Button size="sm" variant={l.indexed_at ? "ghost" : "secondary"} onClick={() => indexSyllabus(l)} disabled={!pineconeReady || busy !== null} aria-label={`Index ${l.branch_code} year ${l.year}`}>
                  {busy === `s-${l.id}` ? <Spinner size={14} /> : <RefreshCw className="size-4" />}
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><FileUp className="size-5 text-primary" /> Upload notes or any PDF</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="k-title">Title</Label>
            <Input id="k-title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. DSA Unit 3 notes" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="k-file">PDF file</Label>
            <Input id="k-file" type="file" accept="application/pdf" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="k-url">or public PDF link</Label>
            <Input id="k-url" value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} placeholder="https://drive.google.com/file/d/..." />
          </div>
          <Input placeholder="Subject code (optional)" value={form.subject_code} onChange={(e) => setForm({ ...form, subject_code: e.target.value })} aria-label="Subject code" />
          <div className="grid grid-cols-2 gap-3">
            <Select value={form.branch_code} onChange={(e) => setForm({ ...form, branch_code: e.target.value })} aria-label="Branch">
              <option value="">All branches</option>
              {branches.map((b) => <option key={b.code} value={b.code}>{b.code}</option>)}
            </Select>
            <Select value={form.year} onChange={(e) => setForm({ ...form, year: e.target.value })} aria-label="Year">
              <option value="">Any year</option>
              {[1, 2, 3, 4].map((y) => <option key={y} value={y}>Year {y}</option>)}
            </Select>
          </div>
          <Button onClick={upload} disabled={!pineconeReady || busy !== null || !form.title || (!file && !form.url)} className="sm:col-span-2">
            {busy === "upload" ? <><Spinner size={16} /> Indexing...</> : <><Database className="size-4" /> Index into Pinecone</>}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Indexed documents</CardTitle></CardHeader>
        <CardContent>
          {docs.length ? (
            <ul className="divide-y divide-border">
              {docs.map((d) => (
                <li key={d.id} className="flex items-center justify-between gap-3 py-3 text-sm">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{d.title}</p>
                    <p className="text-xs text-muted-foreground">{d.chunk_count} chunks · {d.branch_code ?? "All"} · {d.year ? `Year ${d.year}` : "Any year"} · {formatDate(d.created_at)}</p>
                    {d.error && <p className="text-xs text-danger">{d.error}</p>}
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={d.status === "indexed" ? "success" : d.status === "failed" ? "danger" : "outline"}>{d.status}</Badge>
                    <Button size="icon" variant="ghost" onClick={() => remove(d.id)} aria-label="Delete document"><Trash2 className="size-4 text-danger" /></Button>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No documents indexed yet. Start with the syllabus PDFs above.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
