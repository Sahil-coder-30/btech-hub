import type { Metadata } from "next";
import { Camera } from "lucide-react";
import { DoubtSolver } from "@/components/features/doubt-solver";
import { PageHeader } from "@/components/ui/misc";

export const metadata: Metadata = { title: "Photo Doubt Solver" };

export default function DoubtPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <PageHeader
        eyebrow="Multimodal AI"
        icon={Camera}
        title="Photo Doubt Solver"
        description="Snap a question from your book or PYQ paper. Gemini reads it and explains the solution step by step."
      />
      <DoubtSolver />
    </div>
  );
}
