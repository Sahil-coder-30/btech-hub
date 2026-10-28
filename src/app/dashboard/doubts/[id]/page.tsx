import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";
import { DoubtView } from "@/components/dashboard/doubt-view";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/supabase";
import { redirectToLogin } from "@/lib/login-redirect";

export const metadata: Metadata = { title: "Doubt" };
export const dynamic = "force-dynamic";

export default async function DoubtPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) redirectToLogin(`/dashboard/doubts/${encodeURIComponent(id)}`);
  if (!z.string().uuid().safeParse(id).success) notFound();

  const { data } = await db().from("doubts").select("id, question, answer, had_image, created_at").eq("id", id).eq("user_id", user.id).maybeSingle();
  if (!data) notFound();

  return <DoubtView doubt={data} />;
}
