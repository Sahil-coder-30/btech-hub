"use client";

import { AnimatePresence, motion } from "motion/react";
import { CheckCircle2, Clock, FileText, ImageIcon, Languages, ScanText, Trash2, TriangleAlert, UploadCloud, XCircle } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label, Select } from "@/components/ui/input";
import { Spinner } from "@/components/ui/misc";
import { cn, formatDate, YEAR_LABELS } from "@/lib/utils";

type SubjectOption = { title: string; code: string; year: number };
type Upload = {
  id: string;
  title: string;
  subject_title: string | null;
  type: string;
  file_name: string;
  page_count: number;
  ocr_methods: { text_layer: number; ocr: number; vision: number };
  ocr_confidence: number | null;
  quality: { ok: boolean; issues: string[] } | null;
  analysis: { language: string; subject_codes: string[]; keywords: string[]; words: number; suggested_type: string };
  status: "pending" | "approved" | "rejected" | "failed";
  review_note: string | null;
  created_at: string;
};

const BRANCHES = ["CSE", "CSEAIML", "CSEDS", "IT", "ECE", "EE", "EEE", "ME", "CE"];
const STATUS: Record<Upload["status"], { label: string; variant: "warning" | "success" | "danger" | "outline"; icon: typeof Clock }> = {
  pending: { label: "In review", variant: "warning", icon: Clock },
  approved: { label: "Live", variant: "success", icon: CheckCircle2 },
  rejected: { label: "Rejected", variant: "danger", icon: XCircle },
  failed: { label: "Failed", variant: "danger", icon: TriangleAlert },
};
const LANG: Record<string, string> = { en: "English", hi: "Hindi", "en+hi": "English + Hindi" };

export function UploadCenter({ subjects, defaults }: { subjects: SubjectOption[]; defaults: { branch: string; year: number } }) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [form, setForm] = useState({ title: "", subject: "", type: "notes", branch: defaults.branch, year: defaults.year ? String(defaults.year) : "", drive_url: "" });
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ upload: Upload; preview: string; seconds: number } | null>(null);
  const [uploads, setUploads] = useState<Upload[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(() => {
    fetch("/api/uploads")
      .then((r) => r.json())
      .then((d) => setUploads(d.uploads ?? []))
      .catch(() => {});
  }, []);
  useEffect(load, [load]);

  useEffect(() => {
    if (!file || !file.type.startsWith("image/")) return setPreview(null);
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const pick = (f?: File) => {
    if (!f) return;
    if (f.size > 20 * 1024 * 1024) return toast.error("File must be under 20 MB");
    if (!/pdf|image\//.test(f.type)) return toast.error("Upload a PDF or an image");
    setFile(f);
    setResult(null);
    if (!form.title) setForm((s) => ({ ...s, title: f.name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").slice(0, 150) }));
  };

  const submit = async () => {
    if (!file) return toast.error("Choose a file first");
    const subject = subjects.find((s) => s.title === form.subject);
    const body = new FormData();
    body.set("file", file);
    body.set("title", form.title);
    body.set("type", form.type);
    body.set("consent", String(consent));
    if (form.subject) body.set("subject_title", form.subject);
    if (subject?.code) body.set("subject_code", subject.code);
    if (form.branch) body.set("branch_code", form.branch);
    if (form.year) body.set("year", form.year);
    if (form.drive_url.trim()) body.set("drive_url", form.drive_url.trim());

    setBusy(true);
    try {
      const res = await fetch("/api/uploads", { method: "POST", body });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Upload failed");
      setResult(data);
      setFile(null);
      setConsent(false);
      setForm((s) => ({ ...s, title: "", drive_url: "" }));
      toast.success("Uploaded! It goes live after a quick review.");
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  };

  const withdraw = async (id: string) => {
    const res = await fetch(`/api/uploads?id=${id}`, { method: "DELETE" });
    if (res.ok) setUploads((u) => u.filter((x) => x.id !== id));
  };

  const canSubmit = file && form.title.trim().length >= 3 && consent && !busy;

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
        <Card>
          <CardContent className="space-y-4 pt-6">
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragging(false);
                pick(e.dataTransfer.files[0]);
              }}
              onClick={() => inputRef.current?.click()}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === "Enter" && inputRef.current?.click()}
              className={cn(
                "grid min-h-56 cursor-pointer place-items-center overflow-hidden rounded-2xl border-2 border-dashed p-4 text-center transition",
                dragging ? "border-primary bg-primary/5" : "border-border hover:border-primary/50",
              )}
            >
              {preview ? (
                <img src={preview} alt="Selected page" className="max-h-64 rounded-lg object-contain" />
              ) : file ? (
                <div className="flex flex-col items-center gap-2">
                  <FileText className="size-10 text-primary" />
                  <p className="font-medium">{file.name}</p>
                  <p className="text-xs text-muted-foreground">{(file.size / 1024 / 1024).toFixed(1)} MB</p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-3">
                  <span className="grid size-14 place-items-center rounded-2xl bg-primary/10 text-primary">
                    <UploadCloud className="size-7" />
                  </span>
                  <p className="font-medium">Drop a PDF or photo, or click to choose</p>
                  <p className="text-xs text-muted-foreground">PDF, JPG, PNG, WEBP up to 20 MB · scanned pages are fine</p>
                </div>
              )}
              <input ref={inputRef} type="file" accept="application/pdf,image/*" className="hidden" onChange={(e) => pick(e.target.files?.[0])} />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="u-title">Title</Label>
              <Input id="u-title" value={form.title} maxLength={150} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Unit 3 Quantum Mechanics handwritten notes" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="u-subject">Subject</Label>
              <Input id="u-subject" list="u-subjects" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} placeholder="Start typing a subject" />
              <datalist id="u-subjects">
                {subjects.map((s) => (
                  <option key={s.title} value={s.title} />
                ))}
              </datalist>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="u-drive">Google Drive link (optional)</Label>
              <Input id="u-drive" value={form.drive_url} onChange={(e) => setForm({ ...form, drive_url: e.target.value })} placeholder="https://drive.google.com/file/d/..." />
              <p className="text-[11px] text-muted-foreground">Public share link so students can view or download the full document once approved.</p>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <Select aria-label="Type" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                <option value="notes">Notes</option>
                <option value="pyq">PYQ paper</option>
                <option value="imp_question">Important Qs</option>
                <option value="other">Other</option>
              </Select>
              <Select aria-label="Year" value={form.year} onChange={(e) => setForm({ ...form, year: e.target.value })}>
                <option value="">Any year</option>
                {[1, 2, 3, 4].map((y) => (
                  <option key={y} value={y}>{YEAR_LABELS[y]}</option>
                ))}
              </Select>
              <Select aria-label="Branch" value={form.branch} onChange={(e) => setForm({ ...form, branch: e.target.value })}>
                <option value="">All branches</option>
                {BRANCHES.map((b) => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </Select>
            </div>
            <label className="flex items-start gap-2 text-sm text-muted-foreground">
              <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-1 size-4 accent-[var(--primary)]" />
              I made this material or have the right to share it, and it contains no personal details.
            </label>
            <Button size="lg" className="w-full" onClick={submit} disabled={!canSubmit}>
              {busy ? (
                <>
                  <Spinner size={16} /> Reading with OCR... (about 1 sec per page)
                </>
              ) : (
                <>
                  <ScanText className="size-4" /> Upload and read
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ScanText className="size-5 text-primary" /> What our ML service found
            </CardTitle>
            <CardDescription>Text layer for digital PDFs, local OCR for scans and photos, plus a photo quality check.</CardDescription>
          </CardHeader>
          <CardContent>
            <AnimatePresence mode="wait">
              {result ? (
                <motion.div key="r" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4 text-sm">
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <Stat label="Pages" value={String(result.upload.page_count)} />
                    <Stat label="OCR confidence" value={result.upload.ocr_confidence ? `${Math.round(result.upload.ocr_confidence * 100)}%` : "Text PDF"} />
                    <Stat label="Took" value={`${result.seconds.toFixed(1)}s`} />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="secondary">
                      <Languages className="mr-1 size-3" /> {LANG[result.upload.analysis.language] ?? result.upload.analysis.language}
                    </Badge>
                    <Badge variant="outline">Looks like: {result.upload.analysis.suggested_type.replace("_", " ")}</Badge>
                    {result.upload.analysis.subject_codes.map((c) => (
                      <Badge key={c} variant="outline">{c}</Badge>
                    ))}
                  </div>
                  {result.upload.quality && !result.upload.quality.ok && (
                    <div className="space-y-1 rounded-xl bg-warning/10 p-3 text-warning" role="status">
                      {result.upload.quality.issues.map((i) => (
                        <p key={i} className="flex items-start gap-2">
                          <TriangleAlert className="mt-0.5 size-4 shrink-0" /> {i}
                        </p>
                      ))}
                    </div>
                  )}
                  <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded-xl border border-border bg-background/50 p-3 text-xs text-muted-foreground">{result.preview}</pre>
                </motion.div>
              ) : (
                <motion.p key="e" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-sm text-muted-foreground">
                  After you upload, you will see the extracted text, detected language and subject codes, and any photo quality issues here.
                </motion.p>
              )}
            </AnimatePresence>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>My uploads</CardTitle>
          <CardDescription>Approved uploads are indexed and Vac can answer from them.</CardDescription>
        </CardHeader>
        <CardContent>
          {uploads.length ? (
            <ul className="divide-y divide-border">
              {uploads.map((u) => {
                const s = STATUS[u.status];
                return (
                  <li key={u.id} className="flex flex-wrap items-center gap-3 py-3 text-sm">
                    {u.file_name.toLowerCase().endsWith(".pdf") ? <FileText className="size-5 text-muted-foreground" /> : <ImageIcon className="size-5 text-muted-foreground" />}
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{u.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {u.subject_title ?? "No subject"} · {u.page_count} page{u.page_count === 1 ? "" : "s"} · {formatDate(u.created_at)}
                        {u.review_note ? ` · ${u.review_note}` : ""}
                      </p>
                    </div>
                    <Badge variant={s.variant}>
                      <s.icon className="mr-1 size-3" /> {s.label}
                    </Badge>
                    {u.status === "pending" && (
                      <Button variant="ghost" size="icon" onClick={() => withdraw(u.id)} aria-label={`Withdraw ${u.title}`}>
                        <Trash2 className="size-4" />
                      </Button>
                    )}
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No uploads yet. Your first one can help your whole batch.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border p-2">
      <p className="font-display text-lg font-bold">{value}</p>
      <p className="text-[11px] text-muted-foreground">{label}</p>
    </div>
  );
}
