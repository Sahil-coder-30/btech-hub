import { redirect } from "next/navigation";

export default function AcademicSettingsRedirect() {
  redirect("/settings?tab=update-profile");
}
