import { redirect } from "next/navigation";

export default function AppearanceSettingsRedirect() {
  redirect("/settings?tab=appearance");
}
