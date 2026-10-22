import { redirect } from "next/navigation";
import { EntryGate } from "@/components/layout/entry-loader";
import { Hero } from "@/components/landing/hero";
import { StatsStrip } from "@/components/landing/stats-strip";
import { PortalModules } from "@/components/landing/portal-modules";
import { VacWorkflow } from "@/components/landing/vac-workflow";
import { AiStudioTabs } from "@/components/landing/ai-studio-tabs";
import { BeforeAfter } from "@/components/landing/before-after";
import { GetStartedSteps } from "@/components/landing/get-started-steps";
import { LandingFaq } from "@/components/landing/landing-faq";
import { FinalCta } from "@/components/landing/final-cta";
import { SystemDock } from "@/components/layout/system-dock";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  let session = null;
  try {
    session = await getSession();
  } catch {
    session = null;
  }

  // Enforce private routing: Authenticated users go straight to their dashboard
  if (session) {
    redirect("/dashboard");
  }

  // Sections alternate between the page background and the surface (sec-alt) band
  return (
    <EntryGate>
      <main style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
        {/* 1. Hero: 3D SGPA plane, Vac robot gif and sign in */}
        <Hero />

        {/* 2. Key numbers and the branches we cover */}
        <StatsStrip />

        {/* 3. The four main tools */}
        <PortalModules />

        {/* 4. How the Vac agent works */}
        <VacWorkflow />

        {/* 5. AI Studio feature previews */}
        <AiStudioTabs />

        {/* 6. The usual way vs B.Tech Hub */}
        <BeforeAfter />

        {/* 7. Onboarding in three steps */}
        <GetStartedSteps />

        {/* 8. Common questions */}
        <LandingFaq />

        {/* 9. Closing call to action */}
        <FinalCta />

        {/* 10. Minimal application system dock (no static marketing footer) */}
        <SystemDock />
      </main>
    </EntryGate>
  );
}
