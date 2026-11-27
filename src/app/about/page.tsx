import type { Metadata } from "next";
import { Bot, Database, Info, Layers, Lock, Sparkles } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/misc";

export const metadata: Metadata = { title: "About" };

const STACK = [
  { icon: Layers, title: "Next.js 16 + TypeScript", text: "App Router, server components, typed API routes and a Tailwind v4 design system." },
  { icon: Bot, title: "LangChain agent", text: "Vac is a tool-calling agent with 12 tools: SGPA/CGPA maths, subjects, resources, syllabus, RAG search, quiz, planner and profile." },
  { icon: Sparkles, title: "Google Gemini", text: "Chat, structured output for quizzes and plans, multimodal vision for photo doubts, and embeddings." },
  { icon: Database, title: "Supabase + Pinecone", text: "Postgres holds the catalogue and student activity. Pinecone stores vectors for retrieval augmented generation." },
  { icon: Lock, title: "Passport + JWT", text: "Google OAuth through Passport.js, CSRF-safe state cookie, and a signed HS256 JWT in an httpOnly cookie." },
];

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <PageHeader eyebrow="About" icon={Info} title="All problems, one solution." description="B.Tech Hub helps AKTU students with calculators, syllabus, notes and an AI study companion called Vac." />
      <div className="grid gap-4 md:grid-cols-2">
        {STACK.map((s) => (
          <Card key={s.title}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><s.icon className="size-5 text-primary" /> {s.title}</CardTitle>
              <CardDescription>{s.text}</CardDescription>
            </CardHeader>
          </Card>
        ))}
        <Card className="md:col-span-2">
          <CardContent className="pt-6 text-sm text-muted-foreground">
            Built by Sahil Sharma for AKTU students. B.Tech Hub is a student-built engineering project and is not affiliated with AKTU. Always verify official notices on aktu.ac.in.
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
