import type { Metadata } from "next";
import { Shield } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/misc";

export const metadata: Metadata = { title: "Privacy Policy" };

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <PageHeader eyebrow="Legal" icon={Shield} title="Privacy Policy" description="Last updated: October 2026" />
      <Card>
        <CardContent className="prose-vac space-y-4 pt-6 text-sm">
          <h3>What we collect</h3>
          <ul>
            <li>From Google login: your name, email and profile photo.</li>
            <li>What you choose to save: branch, year, SGPAs, quiz attempts, study plans, bookmarks and doubts.</li>
            <li>Chat messages with Vac, to improve answers and prevent abuse.</li>
            <li>An anonymous visitor count.</li>
          </ul>
          <h3>How we use it</h3>
          <p>Only to run and personalise B.Tech Hub. We do not sell data. Questions you send to AI features are processed by Google Gemini.</p>
          <h3>Cookies</h3>
          <p>We use one essential httpOnly cookie that holds your signed login session (JWT), plus short lived cookies during Google login for security. No advertising cookies.</p>
          <h3>Your choices</h3>
          <p>You can log out any time. To delete your account and data, write to us from the contact page.</p>
        </CardContent>
      </Card>
    </div>
  );
}
