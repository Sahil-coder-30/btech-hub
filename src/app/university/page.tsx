import type { Metadata } from "next";
import { Landmark } from "lucide-react";
import { UniversityTabs } from "@/components/features/university-tabs";
import { PageHeader } from "@/components/ui/misc";
import { getUniversityInfo } from "@/lib/data";

export const metadata: Metadata = { title: "University Info" };
export const dynamic = "force-dynamic";

export default async function UniversityPage() {
  const sections = await getUniversityInfo();
  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <PageHeader
        eyebrow="AKTU"
        icon={Landmark}
        title="University Info"
        description="Ordinances, grading, credits, important links, news and the UP scholarship guide in one place."
      />
      <UniversityTabs sections={sections} />
    </div>
  );
}
