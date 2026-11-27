import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { CircularDetail } from "@/components/features/circular-detail";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { getCircular } from "@/lib/circulars";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

type Params = Promise<{ id: string }>;

async function load(params: Params) {
  const { id } = await params;
  return /^[\w-]{3,80}$/.test(id) ? getCircular(id) : null;
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const circular = await load(params);
  return { title: circular ? `${circular.title.slice(0, 70)} · AKTU Circular` : "AKTU Circular" };
}

export default async function CircularPage({ params }: { params: Params }) {
  const circular = await load(params);
  if (!circular) notFound();

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <Link href="/circulars" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" aria-hidden /> All circulars
      </Link>

      <header className="mt-4">
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          {circular.published_on && <time dateTime={circular.published_on}>{formatDate(circular.published_on)}</time>}
          {circular.department && <Badge variant="secondary">{circular.department}</Badge>}
        </div>
        <h1 className="mt-2 text-2xl font-bold leading-tight tracking-tight sm:text-3xl">{circular.title}</h1>
        <a href={circular.pdf_url} target="_blank" rel="noopener noreferrer" className={buttonVariants({ variant: "outline", size: "sm", className: "mt-4" })}>
          <ExternalLink aria-hidden /> Open original PDF
        </a>
      </header>

      <CircularDetail initial={circular} />
    </div>
  );
}
