import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CircularDetail } from "@/components/features/circular-detail";
import { getCircular } from "@/lib/circulars";

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

  return <CircularDetail initial={circular} />;
}
