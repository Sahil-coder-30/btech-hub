"use client";

import { Camera, Copy, HelpCircle, MessageCircle, Plus, Sparkles, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { DashHeader, DashPage, Panel, askVac } from "@/components/dashboard/ui";
import { Markdown } from "@/components/markdown";
import { Button, buttonVariants } from "@/components/ui/button";
import { formatDate } from "@/lib/utils";

type Doubt = { id: string; question: string | null; answer: string; had_image: boolean; created_at: string };

export function DoubtView({ doubt }: { doubt: Doubt }) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);
  const question = doubt.question?.trim() || null;
  const title = question ? (question.length > 80 ? `${question.slice(0, 80).trimEnd()}...` : question) : "Doubt";

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(doubt.answer);
      toast.success("Answer copied");
    } catch {
      toast.error("Could not copy. Select the text instead.");
    }
  };

  const remove = async () => {
    if (!window.confirm("Delete this doubt? This cannot be undone.")) return;
    setDeleting(true);
    const res = await fetch(`/api/dashboard/doubts/${doubt.id}`, { method: "DELETE" }).catch(() => null);
    if (!res?.ok) {
      setDeleting(false);
      return toast.error("Could not delete the doubt. Please try again.");
    }
    toast.success("Doubt deleted");
    router.push("/dashboard");
    router.refresh();
  };

  return (
    <DashPage className="space-y-6">
      <DashHeader
        title={title}
        description={
          <span className="inline-flex flex-wrap items-center gap-2">
            <span>Solved on {formatDate(doubt.created_at)}</span>
            {doubt.had_image && (
              <span className="inline-flex h-6 items-center gap-1 rounded-full bg-accent px-2.5 text-xs font-semibold text-accent-foreground">
                <Camera className="size-3" /> Photo question
              </span>
            )}
          </span>
        }
        actions={
          <>
            <Button size="sm" onClick={() => askVac(`Follow-up on my doubt: ${question ?? "the photo question"}`)}>
              <MessageCircle /> Ask a follow-up
            </Button>
            <Link href="/doubt" className={buttonVariants({ size: "sm", variant: "secondary" })}>
              <Plus /> New doubt
            </Link>
            <Button size="sm" variant="outline" onClick={remove} disabled={deleting} aria-label="Delete doubt" className="hover:border-danger/40 hover:text-danger">
              <Trash2 /> <span className="hidden sm:inline">{deleting ? "Deleting..." : "Delete"}</span>
            </Button>
          </>
        }
      />

      <Panel title="Your question" icon={HelpCircle} accent="blue">
        {question ? (
          <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{question}</p>
        ) : (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Camera className="size-4" /> You asked this one with a photo.
          </p>
        )}
      </Panel>

      <Panel
        title="Step-by-step answer"
        icon={Sparkles}
        accent="violet"
        action={
          <Button size="sm" variant="ghost" onClick={copy} aria-label="Copy answer">
            <Copy /> <span className="hidden sm:inline">Copy answer</span>
          </Button>
        }
      >
        <Markdown className="min-w-0 overflow-x-auto text-sm">{doubt.answer}</Markdown>
      </Panel>
    </DashPage>
  );
}
