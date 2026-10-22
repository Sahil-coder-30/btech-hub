import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { UploadCloud } from "lucide-react";
import { UploadCenter } from "@/components/features/upload-center";
import { PageHeader } from "@/components/ui/misc";
import { getCurrentUser } from "@/lib/auth";
import { getAllSubjects } from "@/lib/data";

export const metadata: Metadata = { title: "Upload notes" };
export const dynamic = "force-dynamic";

export default async function UploadPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/upload");

  const subjects = await getAllSubjects();
  const seen = new Set<string>();
  const options = subjects
    .flatMap((s) => (s.options.length ? s.options : [s.title]).map((title) => ({ title, code: title.match(/\(([A-Z0-9*]+)\)/)?.[1] ?? s.primary_code ?? "", year: s.year })))
    .filter((o) => !seen.has(o.title) && seen.add(o.title));

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <PageHeader
        eyebrow="OCR + Vision"
        icon={UploadCloud}
        title="Share your notes"
        description="Upload a PDF or a photo of your notes or a PYQ paper. Our ML service reads it with OCR, checks the photo quality, and after a quick review it becomes searchable for every student through Vac and Ask your Syllabus."
      />
      <UploadCenter subjects={options} defaults={{ branch: user.branch_code ?? "", year: user.year ?? 0 }} />
    </div>
  );
}
