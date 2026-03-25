import { AppShellLayout } from "@/components/app-shell/app-shell-layout";
import { requireRole } from "@/lib/auth";
import { getAppShellSnapshot } from "@/lib/app-shell/data";

const memberNav = [
  {
    href: "/member",
    label: "Dashboard",
    description: "Mi dia de trabajo, handoffs nuevos y carga activa.",
  },
  {
    href: "/member/leads",
    label: "Leads",
    description: "Bandeja diaria para seguimiento, prioridad y cierre.",
  },
  {
    href: "/member/profile",
    label: "Perfil",
    description: "Datos de trabajo y configuracion del sponsor.",
  },
  {
    href: "/member/channel",
    label: "Canal",
    description: "Conexion de WhatsApp y readiness del canal real.",
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
        areaDescription="Workspace personal del sponsor para aceptar handoffs, hacer seguimiento y sostener su canal de atencion."
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
