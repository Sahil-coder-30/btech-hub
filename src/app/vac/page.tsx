import type { Metadata } from "next";
import { getCurrentUser, getSession } from "@/lib/auth";
import { buildStudentContext } from "@/lib/profile";
import type { User } from "@/lib/types";
import { VacStudioClient } from "./vac-studio-client";

export const metadata: Metadata = {
  title: "Vac AI Studio",
  description: "Chat with Vac AI, your intelligent AKTU academic assistant for syllabus search, grade calculation, and exam preparation.",
};

export default async function VacPage() {
  const dbUser = await getCurrentUser().catch(() => null);
  const session = !dbUser ? await getSession().catch(() => null) : null;
  const user: User | null =
    dbUser ||
    (session
      ? {
          id: session.id,
          google_id: "",
          email: session.email,
          name: session.name,
          avatar_url: session.avatar_url,
          role: session.role,
          branch_code: null,
          year: null,
          semester: null,
          onboarded_at: null,
          created_at: new Date().toISOString(),
        }
      : null);

  const context = user ? await buildStudentContext(user).catch(() => null) : null;

  return <VacStudioClient user={user} studentContext={context} />;
}
