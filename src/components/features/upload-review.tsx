"use client";

import { Check, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/misc";
import { cn, formatDate } from "@/lib/utils";

type ReviewItem = {
  id: string;
  title: string;
  subject_title: string | null;
  subject_code: string | null;
  branch_code: string | null;
  year: number | null;
  type: string;
  file_name: string;
  page_count: number;
  ocr_methods: Record<string, number>;
  ocr_confidence: number | null;
  quality: { ok: boolean; issues: string[] } | null;
  analysis: { language: string; subject_codes: string[]; words: number };
  status: string;
  review_note: string | null;
  created_at: string;
  preview: string;
  users: { name: string | null; email: string } | null;
};

const TABS = ["pending", "approved", "rejected", "failed"] as const;

export function UploadReview() {
  const [tab, setTab] = useState<(typeof TABS)[number]>("pending");
  const [items, setItems] = useState<ReviewItem[] | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(() => {
    setItems(null);
    fetch(`/api/admin/uploads?status=${tab}`)
      .then((r) => r.json())
      .then((d) => setItems(d.uploads ?? []))
      .catch(() => setItems([]));
  }, [tab]);
  useEffect(load, [load]);

  const review = async (id: string, action: "approve" | "reject") => {
    setBusy(id);
    try {
      const res = await fetch("/api/admin/uploads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action, note: notes[id] || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(action === "approve" ? `Indexed ${data.chunks} chunks into Pinecone` : "Upload rejected");
      setItems((list) => list?.filter((i) => i.id !== id) ?? null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Review failed");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2 overflow-x-auto" role="tablist">
        {TABS.map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={cn("shrink-0 rounded-xl px-4 py-2 text-sm font-medium capitalize transition", tab === t ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted")}
          >
            {t}
          </button>
        ))}
      </div>

      {items === null ? (
        <div className="grid place-items-center py-16">
          <Spinner size={28} />
        </div>
      ) : items.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">Nothing here.</p>
      ) : (
        items.map((u) => (
          <Card key={u.id}>
            <CardContent className="space-y-3 pt-5">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-semibold">{u.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {u.users?.name ?? u.users?.email ?? "Student"} · {formatDate(u.created_at)} · {u.file_name} · {u.page_count} pages
                  </p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <Badge variant="outline" className="capitalize">{u.type.replace("_", " ")}</Badge>
                  {u.subject_title && <Badge variant="secondary">{u.subject_title}</Badge>}
                  {u.branch_code && <Badge variant="outline">{u.branch_code}</Badge>}
                  {u.year && <Badge variant="outline">Year {u.year}</Badge>}
                  <Badge variant={u.ocr_confidence === null || u.ocr_confidence > 0.75 ? "success" : "warning"}>
                    {u.ocr_confidence === null ? "Text PDF" : `OCR ${Math.round(u.ocr_confidence * 100)}%`}
                  </Badge>
                </div>
              </div>
              {u.quality && !u.quality.ok && <p className="text-xs text-warning">Photo issues: {u.quality.issues.join(" ")}</p>}
              <details className="rounded-xl border border-border bg-background/40 p-3">
                <summary className="cursor-pointer text-sm font-medium">Extracted text ({u.analysis.words} words)</summary>
                <pre className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap text-xs text-muted-foreground">{u.preview}</pre>
              </details>
              {u.review_note && <p className="text-xs text-muted-foreground">Note: {u.review_note}</p>}
              {tab === "pending" && (
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Input placeholder="Note for the student (optional)" value={notes[u.id] ?? ""} onChange={(e) => setNotes({ ...notes, [u.id]: e.target.value })} className="flex-1" />
                  <Button onClick={() => review(u.id, "approve")} disabled={busy !== null}>
                    {busy === u.id ? <Spinner size={14} /> : <Check className="size-4" />} Approve and index
                  </Button>
                  <Button variant="outline" onClick={() => review(u.id, "reject")} disabled={busy !== null}>
                    <X className="size-4" /> Reject
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}
