import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";

export default async function MemberAiSettingsRedirectPage() {
  const user = await getSessionUser();

  if (!user) {
    redirect("/login");
  }

  if (user.role === "TEAM_ADMIN") {
    redirect("/management/ai-config");
  }

  redirect("/member");
}
