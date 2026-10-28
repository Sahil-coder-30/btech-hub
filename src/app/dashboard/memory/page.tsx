import type { Metadata } from "next";
import { DashHeader, DashPage } from "@/components/dashboard/ui";
import { MemoryManager } from "@/components/features/memory";
import { getCurrentUser } from "@/lib/auth";
import { listMemories } from "@/lib/profile";
import { redirectToLogin } from "@/lib/login-redirect";

export const metadata: Metadata = { title: "My Memory" };
export const dynamic = "force-dynamic";

export default async function MemoryPage() {
  const user = await getCurrentUser();
  if (!user) redirectToLogin("/dashboard/memory");
  const memories = await listMemories(user.id);

  return (
    <DashPage>
      <DashHeader
        title="What Vac remembers"
        description="Vac saves short notes about your goals, struggles and preferences so its advice fits you. Delete anything you don't want it to know."
      />
      <div className="mt-6">
        <MemoryManager initial={memories} />
      </div>
    </DashPage>
  );
}
