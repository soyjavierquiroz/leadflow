import { AppShellLayout } from "@/components/app-shell/app-shell-layout";
import { requireRole } from "@/lib/auth";
import { getAppShellSnapshot } from "@/lib/app-shell/data";

const teamNav = [
  {
    href: "/team",
    label: "Dashboard",
    description: "Pulso del equipo, capacidad comercial y prioridades del día.",
  },
  {
    href: "/team/funnels",
    label: "Funnels",
    description: "Embudos activos, readiness y salida al mercado.",
  },
  {
    href: "/team/domains",
    label: "Domains",
    description: "Onboarding SaaS de dominios externos y su estado DNS/TLS.",
  },
  {
    href: "/team/publications",
    label: "Publicaciones",
    description: "Rutas activas donde ya está captando el funnel.",
  },
  {
    href: "/team/members",
    label: "Mi Equipo",
    description: "Licencias activas, invitados y control operativo del squad.",
  },
  {
    href: "/team/pools",
    label: "Pools",
    description: "Cobertura de rotación y fallback de handoff.",
  },
  {
    href: "/team/leads",
    label: "Leads",
    description: "Bandeja operativa para seguimiento, reminders y cierre.",
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
      areaDescription="Centro operativo del equipo para revisar captación, capacidad, asignación y seguimiento comercial."
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
