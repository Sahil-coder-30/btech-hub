import Link from "next/link";
import { FAQS } from "@/lib/faqs";
import { SectionHeader } from "./section-header";

export function LandingFaq() {
  return (
    <section id="faq" className="wrap sec">
      <div className="faq-grid">
        <div>
          <SectionHeader
            eyebrow="FAQ"
            title="Questions, answered."
            sub="Everything students usually ask before signing in. Still stuck? We reply to every message."
          />
          <div style={{ display: "flex", flexWrap: "wrap", gap: "10px" }}>
            <Link href="/faq" className="btn btn-secondary">
              All FAQs
            </Link>
            <Link href="/contact" className="btn btn-ghost">
              Contact us
            </Link>
          </div>
        </div>

        <div>
          {FAQS.slice(0, 6).map((f, i) => (
            <details key={f.q} className="faq-item" open={i === 0}>
              <summary>
                {f.q}
                <svg className="i" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M12 5v14M5 12h14" />
                </svg>
              </summary>
              <p>{f.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
