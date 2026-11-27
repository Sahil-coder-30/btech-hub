import { redirect } from "next/navigation";

export default function AccountSettingsRedirect() {
  redirect("/settings?tab=account");
}
