import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { redirectToLogin } from "@/lib/login-redirect";

export const dynamic = "force-dynamic";

export default async function MemoryPage() {
  const user = await getCurrentUser();
  if (!user) redirectToLogin("/dashboard/profile#vac-memory");
  redirect("/dashboard/profile#vac-memory");
}
