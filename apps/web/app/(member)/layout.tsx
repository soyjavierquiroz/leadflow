import { AppShellLayout } from "@/components/app-shell/app-shell-layout";
import { requireRole } from "@/lib/auth";
import { getAppShellSnapshot } from "@/lib/app-shell/data";

const memberNav = [
  {
    href: "/member",
    label: "Dashboard",
    description: "Resumen personal de handoffs y capacidad actual.",
  },
  {
    href: "/member/leads",
    label: "Leads",
    description: "Leads asignados al sponsor demo activo.",
  },
  {
    href: "/member/profile",
    label: "Perfil",
    description: "Datos operativos y preferencias futuras.",
  },
];

export default async function MemberLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  await requireRole("MEMBER");
  const snapshot = await getAppShellSnapshot();

  return (
    <AppShellLayout
      areaLabel="Sponsor / Member"
      areaDescription="Superficie inicial para sponsors, con enfoque en leads asignados y perfil operativo."
      topBarTitle={snapshot.currentSponsor.displayName}
      personaLabel="Sponsor / Member"
      workspaceName={snapshot.workspace.name}
      sourceMode={snapshot.sourceMode}
      currentUser={snapshot.currentUser}
      nav={memberNav}
    >
      {children}
    </AppShellLayout>
  );
}
