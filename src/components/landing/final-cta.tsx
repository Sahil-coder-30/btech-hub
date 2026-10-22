"use client";

import Link from "next/link";
import { GoogleIcon } from "./google-icon";

export function FinalCta() {
  const openVacChat = () => {
    window.dispatchEvent(new CustomEvent("vac:open", { detail: { prompt: "What can you do for my AKTU exams?" } }));
  };

  return (
    <section className="wrap" style={{ paddingBottom: "104px" }}>
      <div className="cta-band">
        <div>
          <h2>Your next semester starts here.</h2>
          <p style={{ marginTop: "14px", fontSize: "17px", lineHeight: 1.6, opacity: 0.85, maxWidth: "520px" }}>
            Free for every AKTU student. Sign in once and your syllabus, grades and exam plan stay with you.
          </p>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "12px" }}>
          <Link href="/login" className="btn btn-lg btn-on-primary">
            <GoogleIcon />
            Continue with Google
          </Link>
          <button type="button" onClick={openVacChat} className="btn btn-lg btn-ghost-primary">
            Try Vac AI
          </button>
        </div>
      </div>
    </section>
  );
}
