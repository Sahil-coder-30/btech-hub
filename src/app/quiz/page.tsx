import type { Metadata } from "next";
import { Brain } from "lucide-react";
import { QuizRunner } from "@/components/features/quiz-runner";
import { PageHeader } from "@/components/ui/misc";
import { getCurrentUser } from "@/lib/auth";
import { getAllSubjects } from "@/lib/data";
import { readPreferences } from "@/lib/settings";

export const metadata: Metadata = { title: "AI Quiz" };
export const dynamic = "force-dynamic";

export default async function QuizPage() {
  const [subjects, user] = await Promise.all([getAllSubjects(), getCurrentUser().catch(() => null)]);
  // Theory subjects only, each title once
  const seen = new Set<string>();
  const options = subjects
    .filter((s) => s.kind === "theory" && s.primary_code)
    .flatMap((s) => (s.options.length ? s.options : [s.title]))
    .filter((t) => !seen.has(t) && seen.add(t));
  // Saved quiz defaults from Settings. Guests get the standard defaults.
  const { study } = readPreferences(user);

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <PageHeader
        eyebrow="AI practice"
        icon={Brain}
        title="AI Quiz"
        description="Pick a subject and unit. Gemini builds a fresh exam style quiz, grounded in your syllabus, then finds your weak topics."
      />
      <QuizRunner subjects={options} loggedIn={Boolean(user)} defaultDifficulty={study.quizDifficulty} defaultCount={study.quizCount} />
    </div>
  );
}
