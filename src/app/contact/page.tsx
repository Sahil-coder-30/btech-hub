import type { Metadata } from "next";
import { Mail } from "lucide-react";
import { ContactForm } from "@/components/features/contact-form";
import { PageHeader } from "@/components/ui/misc";

export const metadata: Metadata = { title: "Contact" };

export default function ContactPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <PageHeader eyebrow="Support" icon={Mail} title="Contact us" description="Found a wrong link, want a feature, or want to share notes? Send us a message." />
      <ContactForm />
    </div>
  );
}
