"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

function RouteChangeListener({ onComplete }: { onComplete: () => void }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    onComplete();
  }, [pathname, searchParams, onComplete]);

  return null;
}

export function TopProgressBar() {
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(false);

  const handleComplete = () => {
    if (!visible) return;
    setProgress(100);
    const timeout = setTimeout(() => {
      setVisible(false);
      setProgress(0);
    }, 250);
    return () => clearTimeout(timeout);
  };

  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;

    const startProgress = () => {
      setVisible(true);
      setProgress(20);

      let current = 20;
      interval = setInterval(() => {
        current += Math.max(1, Math.floor((90 - current) / 6));
        if (current >= 90) {
          if (interval) clearInterval(interval);
        }
        setProgress(current);
      }, 150);
    };

    const stopProgress = () => {
      if (interval) clearInterval(interval);
      setProgress(100);
      setTimeout(() => {
        setVisible(false);
        setProgress(0);
      }, 250);
    };

    // Listen for click events on anchor tags for instant feedback
    const handleClick = (e: MouseEvent) => {
      const target = (e.target as HTMLElement).closest("a");
      if (!target || !target.href) return;

      const url = new URL(target.href, window.location.origin);
      const isInternal = url.origin === window.location.origin;
      const isNewTab = target.target === "_blank" || e.ctrlKey || e.metaKey || e.shiftKey;
      const isDownload = target.hasAttribute("download");
      const isSamePath = url.pathname === window.location.pathname && url.search === window.location.search;

      if (isInternal && !isNewTab && !isDownload && !isSamePath) {
        startProgress();
      }
    };

    // Custom events so buttons or router.push can trigger instant feedback
    window.addEventListener("click", handleClick, { capture: true });
    window.addEventListener("app:navigation-start", startProgress);
    window.addEventListener("app:navigation-end", stopProgress);

    return () => {
      if (interval) clearInterval(interval);
      window.removeEventListener("click", handleClick, { capture: true });
      window.removeEventListener("app:navigation-start", startProgress);
      window.removeEventListener("app:navigation-end", stopProgress);
    };
  }, []);

  return (
    <>
      <Suspense fallback={null}>
        <RouteChangeListener onComplete={handleComplete} />
      </Suspense>
      {visible && (
        <div
          aria-hidden="true"
          className="fixed top-0 left-0 right-0 z-[999999] h-[3px] pointer-events-none bg-transparent"
        >
          <div
            className="h-full bg-gradient-to-r from-[var(--primary)] via-[var(--mark-solid)] to-[var(--primary)] transition-all duration-200 ease-out shadow-[0_0_12px_var(--primary)]"
            style={{
              width: `${progress}%`,
              opacity: visible ? 1 : 0,
            }}
          />
        </div>
      )}
    </>
  );
}
