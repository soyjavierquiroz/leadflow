import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";

export default async function ProfileRedirectPage() {
  const user = await getSessionUser();

  if (!user) {
    redirect("/login");
  }

  if (user.role === "TEAM_ADMIN") {
    redirect("/team/profile");
  }

  if (user.role === "MEMBER") {
    redirect("/member/profile");
  }

  redirect("/admin");
}
