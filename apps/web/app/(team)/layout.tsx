import { AppShellLayout } from "@/components/app-shell/app-shell-layout";
import { requireRole } from "@/lib/auth";
import { getAppShellSnapshot } from "@/lib/app-shell/data";

const teamNav = [
  {
    href: "/team",
    label: "Dashboard",
    description: "Operación diaria del team y capacidad comercial.",
  },
  {
    href: "/team/funnels",
    label: "Funnels",
    description: "Instancias activas y readiness operativo.",
  },
  {
    href: "/team/publications",
    label: "Publicaciones",
    description: "Dominios, paths y estados de salida.",
  },
  {
    href: "/team/sponsors",
    label: "Sponsors",
    description: "Miembros activos y disponibilidad.",
  },
  {
    href: "/team/pools",
    label: "Pools",
    description: "Rotación y cobertura del handoff.",
  },
  {
    href: "/team/leads",
    label: "Leads",
    description: "Pipeline capturado desde runtime público.",
  },
];

export default async function TeamLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  await requireRole("TEAM_ADMIN");
  const snapshot = await getAppShellSnapshot();

  return (
    <AppShellLayout
      areaLabel="Team Admin"
      areaDescription="Configuración operativa del team, publicaciones activas y seguimiento del pipeline."
      topBarTitle={snapshot.currentTeam.name}
      personaLabel="Team Admin"
      workspaceName={snapshot.workspace.name}
      sourceMode={snapshot.sourceMode}
      currentUser={snapshot.currentUser}
      nav={teamNav}
    >
      {children}
    </AppShellLayout>
  );
}
