import type { Metadata } from "next";
import { Library } from "lucide-react";
import { ResourceBrowser } from "@/components/features/resource-browser";
import { PageHeader } from "@/components/ui/misc";
import { getSession } from "@/lib/auth";
import { getBranches } from "@/lib/data";

export const metadata: Metadata = { title: "Resources" };
export const dynamic = "force-dynamic";

export default async function ResourcesPage({ searchParams }: { searchParams: Promise<{ year?: string; branch?: string; q?: string }> }) {
  const [branches, session, params] = await Promise.all([getBranches(), getSession(), searchParams]);
  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <PageHeader
        eyebrow="Study material"
        icon={Library}
        title="Notes, PYQs & Lectures"
        description="Unit-wise notes, previous year papers, video lectures and important questions for every subject."
      />
      <ResourceBrowser
        branches={branches}
        loggedIn={Boolean(session)}
        initial={{ year: Number(params.year) || 1, branch: params.branch ?? "", q: params.q ?? "" }}
      />
    </div>
  );
}
