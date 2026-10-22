import type { Metadata } from "next";
import { HelpCircle } from "lucide-react";
import { PageHeader } from "@/components/ui/misc";
import { FAQS } from "@/lib/faqs";

export const metadata: Metadata = { title: "FAQ" };

export default function FaqPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <PageHeader eyebrow="Help" icon={HelpCircle} title="Frequently asked questions" />
      <div className="space-y-3">
        {FAQS.map((f) => (
          <details key={f.q} className="glass group rounded-2xl p-5 [&_summary::-webkit-details-marker]:hidden">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium">
              {f.q}
              <span className="text-primary transition group-open:rotate-45">+</span>
            </summary>
            <p className="mt-3 text-sm text-muted-foreground">{f.a}</p>
          </details>
        ))}
      </div>
    </div>
  );
}
