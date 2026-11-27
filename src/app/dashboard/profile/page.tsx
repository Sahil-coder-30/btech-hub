import { redirect } from "next/navigation";

export default function DashboardProfileRedirect() {
  redirect("/settings?tab=profile");
}
