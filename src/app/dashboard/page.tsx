import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { DashboardOverview } from "@/components/dashboard/overview";
import { DashPage } from "@/components/dashboard/ui";
import { getCurrentUser } from "@/lib/auth";
import { getDashboardData } from "@/lib/dashboard";
import { getBranches } from "@/lib/data";

export const metadata: Metadata = { title: "Dashboard" };
export const dynamic = "force-dynamic";

/** Greeting for the student's local time (IST), worked out on the server so both renders agree. */
function greetingFor(date: Date) {
  const hour = Number(date.toLocaleString("en-US", { hour: "numeric", hour12: false, timeZone: "Asia/Kolkata" })) % 24;
  if (hour < 5) return "Burning the midnight oil";
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/dashboard");

  const [data, branches] = await Promise.all([getDashboardData(user), getBranches().catch(() => [])]);
  const now = new Date();

  return (
    <DashPage>
      <DashboardOverview
        user={user}
        branches={branches}
        data={data}
        greeting={greetingFor(now)}
        now={now.getTime()}
      />
    </DashPage>
  );
}
