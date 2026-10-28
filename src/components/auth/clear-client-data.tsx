"use client";

import { useEffect } from "react";
import { clearClientData } from "@/lib/client-data";

/** Rendered on the login page, which only guests can reach. Drops any chat a previous student left. */
export function ClearClientData() {
  useEffect(() => {
    clearClientData();
  }, []);
  return null;
}
