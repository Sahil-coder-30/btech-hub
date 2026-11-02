"use client";

import dynamic from "next/dynamic";
import type { SessionUser } from "@/lib/types";

const VacChat = dynamic(() => import("@/components/chat/vac-chat").then((m) => m.VacChat), {
  ssr: false,
});

const CommandMenu = dynamic(() => import("@/components/command-menu").then((m) => m.CommandMenu), {
  ssr: false,
});

export function LazyWidgets({
  session,
  showWidget,
}: {
  session: SessionUser;
  showWidget: boolean;
}) {
  return (
    <>
      {showWidget && <VacChat user={session} />}
      <CommandMenu />
    </>
  );
}

