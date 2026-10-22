"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { toast } from "sonner";

/** Guest stand-in for VacChat: any "vac:open" trigger sends the visitor to login instead of a dead click. */
export function VacLoginPrompt() {
  const router = useRouter();
  const pathname = usePathname() ?? "/";

  useEffect(() => {
    const onOpen = () => {
      toast.info("Sign in to chat with Vac", { description: "Vac is part of your free student account." });
      router.push(`/login?next=${encodeURIComponent(pathname)}`);
    };
    window.addEventListener("vac:open", onOpen);
    return () => window.removeEventListener("vac:open", onOpen);
  }, [pathname, router]);

  return null;
}
