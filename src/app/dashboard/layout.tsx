import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth";
import { redirectToLogin } from "@/lib/login-redirect";

export const metadata: Metadata = {
  title: {
    default: "Dashboard | B.Tech Hub",
    template: "%s | B.Tech Hub",
  },
};

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) {
    redirectToLogin("/dashboard");
  }

  return <>{children}</>;
}
