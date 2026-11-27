import type { Metadata } from "next";
import { Megaphone } from "lucide-react";
import { CircularsBrowser } from "@/components/features/circulars-browser";
import { PageHeader } from "@/components/ui/misc";
import { normalizeCircularQuery } from "@/lib/circular-query";
import { circularDepartmentCounts, listCirculars } from "@/lib/circulars";

export const metadata: Metadata = {
  title: "AKTU Circulars",
  description: "Every official AKTU circular with a short AI summary. Ask anything about a circular in simple English or Hinglish.",
};
export const dynamic = "force-dynamic";

type SearchParams = Promise<{
  q?: string;
  dept?: string;
  filter?: string;
  period?: string;
  sort?: string;
  page?: string;
}>;

export default async function CircularsPage({ searchParams }: { searchParams: SearchParams }) {
  const raw = await searchParams;
  const query = normalizeCircularQuery(raw);

  const [{ circulars, total }, departments] = await Promise.all([
    listCirculars({
      q: query.q,
      department: query.dept,
      filter: query.filter,
      period: query.period,
      sort: query.sort,
      page: query.page,
    }),
    circularDepartmentCounts(),
  ]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <PageHeader
        eyebrow="AKTU"
        icon={Megaphone}
        title="Circulars"
        description="Official AKTU circulars, newest first. Open one to see what it means in two lines, then ask anything about it."
      />

      <CircularsBrowser
        initialCirculars={circulars}
        initialTotal={total}
        initialQuery={query}
        departments={departments.map((d) => d.department)}
      />
    </div>
  );
}
