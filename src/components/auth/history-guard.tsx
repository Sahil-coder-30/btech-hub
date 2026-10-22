"use client";

import { useEffect } from "react";

/**
 * Browsers can restore a page from the back/forward cache without asking the
 * server, which skips the proxy. Reloading a restored page lets the proxy
 * redirect again, so back never shows the login page after sign in or a
 * private page after logout.
 */
export function HistoryGuard() {
  useEffect(() => {
    const onShow = (event: PageTransitionEvent) => {
      if (event.persisted) window.location.reload();
    };
    window.addEventListener("pageshow", onShow);
    return () => window.removeEventListener("pageshow", onShow);
  }, []);

  return null;
}
