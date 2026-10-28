"use client";

import { motion } from "motion/react";
import { Camera, Copy, ImagePlus, Mic, MicOff, Sparkles, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { usePersistentState } from "@/lib/persist-state";
import { Markdown } from "@/components/markdown";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label, Textarea } from "@/components/ui/input";
import { Skeleton, Spinner } from "@/components/ui/misc";
import { useSpeech } from "@/lib/use-speech";
import { cn } from "@/lib/utils";

const MAX_BYTES = 5 * 1024 * 1024;

export function DoubtSolver() {
  const [question, setQuestion] = usePersistentState("doubt:question", "");
  const [file, setFile] = usePersistentState<File | null>("doubt:file", null);
  const [preview, setPreview] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = usePersistentState("doubt:loading", false);
  const [answer, setAnswer] = usePersistentState("doubt:answer", "");
  const inputRef = useRef<HTMLInputElement>(null);
  const speech = useSpeech((text) => setQuestion(text));

  useEffect(() => {
    if (!file) return setPreview(null);
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  // Paste a screenshot straight from the clipboard
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const item = [...(e.clipboardData?.files ?? [])].find((f) => f.type.startsWith("image/"));
      if (item) pick(item);
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, []);

  const pick = (f: File | undefined) => {
    if (!f) return;
    if (!f.type.startsWith("image/")) return toast.error("Please choose an image file");
    if (f.size > MAX_BYTES) return toast.error("Image must be under 5 MB");
    setFile(f);
  };

  const solve = async () => {
    if (!question.trim() && !file) return toast.error("Add a photo or type your question");
    setLoading(true);
    setAnswer("");
    try {
      const form = new FormData();
      form.set("question", question);
      if (file) form.set("image", file);
      const res = await fetch("/api/doubt", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setAnswer(data.answer);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not solve");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardContent className="space-y-4 pt-6">
          <div
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => { e.preventDefault(); setDragging(false); pick(e.dataTransfer.files[0]); }}
            className={cn("relative grid min-h-64 place-items-center overflow-hidden rounded-2xl border-2 border-dashed transition", dragging ? "border-primary bg-primary/5" : "border-border")}
          >
            {preview ? (
              <>
                <img src={preview} alt="Question preview" className="max-h-80 w-full object-contain" />
                <button onClick={() => setFile(null)} className="absolute right-3 top-3 grid size-8 place-items-center rounded-full bg-black/60 text-white hover:bg-black/80" aria-label="Remove image">
                  <X className="size-4" />
                </button>
              </>
            ) : (
              <div className="flex flex-col items-center gap-3 p-6 text-center">
                <span className="grid size-14 place-items-center rounded-2xl bg-primary/10 text-primary"><ImagePlus className="size-7" /></span>
                <p className="font-medium">Drop a photo, paste a screenshot, or</p>
                <div className="flex flex-wrap justify-center gap-2">
                  <Button variant="secondary" onClick={() => inputRef.current?.click()}>
                    <Camera className="size-4" /> Take / choose photo
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">PNG, JPG or WEBP up to 5 MB</p>
              </div>
            )}
            <input ref={inputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => pick(e.target.files?.[0])} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="d-q">Question or extra context (optional)</Label>
            <div className="relative">
              <Textarea id="d-q" value={question} onChange={(e) => setQuestion(e.target.value)} rows={3} maxLength={2000} placeholder="e.g. Solve part (b) only, or explain using Laplace transform" className="pr-12" />
              {speech.supported && (
                <Button type="button" variant="ghost" size="icon" onClick={speech.toggle} className="absolute bottom-2 right-2" aria-label="Voice input">
                  {speech.listening ? <MicOff className="size-4 text-danger" /> : <Mic className="size-4" />}
                </Button>
              )}
            </div>
          </div>

          <Button size="lg" className="w-full" onClick={solve} disabled={loading}>
            {loading ? <><Spinner size={16} /> Reading and solving...</> : <><Sparkles className="size-4" /> Solve step by step</>}
          </Button>
        </CardContent>
      </Card>

      <Card className="min-h-64">
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>Solution</CardTitle>
          {answer && (
            <Button variant="ghost" size="sm" onClick={() => navigator.clipboard.writeText(answer).then(() => toast.success("Copied"))}>
              <Copy className="size-4" /> Copy
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              <Skeleton className="h-5 w-1/2" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
              <Skeleton className="h-4 w-2/3" />
            </div>
          ) : answer ? (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <Markdown>{answer}</Markdown>
            </motion.div>
          ) : (
            <p className="text-sm text-muted-foreground">Your step by step solution will appear here. Works great for maths, physics, circuits and code.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
