import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { AdminPanel } from "@/components/features/admin-panel";
import { PageHeader } from "@/components/ui/misc";
import { getCurrentUser } from "@/lib/auth";
import { getBranches, getSyllabusLinks } from "@/lib/data";
import { isPineconeConfigured } from "@/lib/env";

export const metadata: Metadata = { title: "Admin" };
export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/admin");
  if (user.role !== "admin") redirect("/dashboard");

  const [branches, syllabus] = await Promise.all([getBranches(), getSyllabusLinks()]);
  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <PageHeader eyebrow="Admin" icon={ShieldCheck} title="Admin Panel" description="Manage resources, fill coming soon links and build the AI knowledge base." />
      <AdminPanel branches={branches} syllabus={syllabus} pineconeReady={isPineconeConfigured()} />
    </div>
  );
}
