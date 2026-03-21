import { redirect } from "next/navigation";
import { LoginForm } from "@/components/auth/login-form";
import { getSessionUser } from "@/lib/auth";

const demoAccounts = [
  {
    label: "Platform Admin",
    role: "SUPER_ADMIN",
    email: "admin@leadflow.local",
    password: "Admin123!",
  },
  {
    label: "Team Ops",
    role: "TEAM_ADMIN",
    email: "team@leadflow.local",
    password: "Team123!",
  },
  {
    label: "Ana Sponsor",
    role: "MEMBER",
    email: "ana.member@leadflow.local",
    password: "Member123!",
  },
  {
    label: "Bruno Sponsor",
    role: "MEMBER",
    email: "bruno.member@leadflow.local",
    password: "Member456!",
  },
];

export default async function LoginPage() {
  const user = await getSessionUser();

  if (user) {
    redirect(user.homePath);
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(148,163,184,0.14),_transparent_28%),linear-gradient(180deg,_#f8fafc_0%,_#eef2f7_100%)] px-5 py-10 md:px-8">
      <div className="mx-auto w-full max-w-6xl">
        <LoginForm demoAccounts={demoAccounts} />
      </div>
    </main>
  );
}
