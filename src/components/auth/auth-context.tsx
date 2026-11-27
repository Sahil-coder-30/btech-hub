"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { SessionUser } from "@/lib/types";

interface AuthContextType {
  user: SessionUser | null;
  loading: boolean;
  refresh: () => Promise<void>;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  refresh: async () => {},
  isAuthenticated: false,
});

export function AuthProvider({
  children,
  initialUser = null,
}: {
  children: ReactNode;
  initialUser?: SessionUser | null;
}) {
  const [user, setUser] = useState<SessionUser | null>(initialUser);
  const [loading, setLoading] = useState<boolean>(!initialUser);

  const refresh = async () => {
    try {
      const res = await fetch("/api/me", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setUser(data.user ?? null);
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (initialUser) return;
    const controller = new AbortController();
    fetch("/api/me", { cache: "no-store", signal: controller.signal })
      .then((res) => (res.ok ? res.json() : { user: null }))
      .then((data) => setUser(data.user ?? null))
      .catch(() => {
        if (!controller.signal.aborted) setUser(null);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [initialUser]);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        refresh,
        isAuthenticated: !!user,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
