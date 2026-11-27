import type { Metadata } from "next";
import { SavedList } from "@/components/dashboard/saved-list";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/supabase";
import type { Resource } from "@/lib/types";
import { redirectToLogin } from "@/lib/login-redirect";

export const metadata: Metadata = { title: "Saved resources" };
export const dynamic = "force-dynamic";

const isResource = (value: unknown): value is Resource =>
  typeof value === "object" && value !== null && "id" in value && "subject_title" in value;

export default async function SavedPage() {
  const user = await getCurrentUser();
  if (!user) redirectToLogin("/dashboard/saved");

  const { data, error } = await db()
    .from("saved_resources")
    .select("resource_id, created_at, resources(*)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(200);

  const resources = (error ? [] : (data ?? []))
    .flatMap((s: { resources: unknown }) => (isResource(s.resources) ? [s.resources] : []));

  return <SavedList initial={resources} />;
}
