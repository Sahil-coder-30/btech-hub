"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(useGSAP);

declare global {
  interface Window {
    __entryDone?: boolean;
  }
}

// Module level, so it resets on a full page load but not on client side navigation.
let hasPlayed = false;

function finish() {
  hasPlayed = true;
  window.__entryDone = true;
  window.dispatchEvent(new Event("entry:done"));
}

/**
 * The original B.Tech Hub entry animation, ported 1:1 from home.js:
 * black screen fades to white, logo spins in, text logo pops, then the logo
 * zooms through the screen and the page rises in.
 */
export function EntryGate({ children }: { children: ReactNode }) {
  const [playing, setPlaying] = useState(() => !hasPlayed);
  // Fixed for the component's lifetime so React never fights GSAP over the inline opacity
  const [startHidden] = useState(() => !hasPlayed);
  const loader = useRef<HTMLDivElement>(null);
  const page = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    if (!playing) {
      window.__entryDone = true;
      return;
    }

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      gsap.set(page.current, { opacity: 1 });
      setPlaying(false);
      finish();
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    gsap.set(loader.current, { backgroundColor: "var(--bg)" });
    gsap.set([".entry-logo", ".entry-logo-text"], { opacity: 0, scale: 0, transformOrigin: "center center" });

    gsap
      .timeline()
      .to(".entry-logo", { duration: 0.6, opacity: 1, scale: 1, rotation: 360, ease: "power3.out" })
      .to(".entry-logo-text", { duration: 0.4, opacity: 1, scale: 1, ease: "back.out(1.7)" })
      .to(".entry-logo-text", { duration: 0.3, opacity: 0, scale: 0.8, ease: "power3.in", delay: 0.2 })
      .to(".entry-logo", { duration: 0.4, scale: 8, opacity: 0, ease: "power4.in" })
      .to(loader.current, {
        duration: 0.3,
        opacity: 0,
        onComplete: () => {
          document.body.style.overflow = previousOverflow;
          setPlaying(false);
        },
      })
      .fromTo(
        page.current,
        { opacity: 0, y: 20 },
        { duration: 0.4, opacity: 1, y: 0, ease: "power2.out", clearProps: "transform", onComplete: finish },
      );

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  return (
    <>
      {playing && (
        <div
          ref={loader}
          aria-hidden
          className="fixed inset-0 z-[100] flex flex-col items-center justify-center"
          style={{ backgroundColor: "var(--bg)" }}
        >
          <img
            src="/images/logo.png"
            alt=""
            className="entry-logo w-[max(6vw,72px)]"
            style={{ opacity: 0, transform: "scale(0)" }}
          />
          <img
            src="/images/text-logo.png"
            alt=""
            className="entry-logo-text w-[max(8vw,110px)]"
            style={{ opacity: 0, transform: "scale(0)" }}
          />
        </div>
      )}
      <div ref={page} style={startHidden ? { opacity: 0 } : undefined}>
        {children}
      </div>
    </>
  );
}

/** True once the entry animation has finished (or was skipped). Lets hero content animate after it. */
export function useEntryDone() {
  const [done, setDone] = useState(false);
  useEffect(() => {
    if (window.__entryDone) return setDone(true);
    const onDone = () => setDone(true);
    window.addEventListener("entry:done", onDone);
    return () => window.removeEventListener("entry:done", onDone);
  }, []);
  return done;
}
