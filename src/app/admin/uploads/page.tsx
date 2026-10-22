import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Inbox } from "lucide-react";
import { UploadReview } from "@/components/features/upload-review";
import { PageHeader } from "@/components/ui/misc";
import { getCurrentUser } from "@/lib/auth";

export const metadata: Metadata = { title: "Review uploads" };
export const dynamic = "force-dynamic";

export default async function AdminUploadsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/admin/uploads");
  if (user.role !== "admin") redirect("/dashboard");

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <PageHeader eyebrow="Admin" icon={Inbox} title="Review student uploads" description="Check the OCR text, then approve to index it into Pinecone or reject it." />
      <UploadReview />
    </div>
  );
}
