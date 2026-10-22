import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SavedList } from "@/components/dashboard/saved-list";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/supabase";
import type { Resource } from "@/lib/types";

export const metadata: Metadata = { title: "Saved resources" };
export const dynamic = "force-dynamic";

export default async function SavedPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/dashboard/saved");

  const { data, error } = await db()
    .from("saved_resources")
    .select("resource_id, created_at, resources(*)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(200);

  const resources = (error ? [] : (data ?? []))
    .map((s) => s.resources as unknown as Resource | null)
    .filter((r): r is Resource => Boolean(r));

  return <SavedList initial={resources} />;
}
