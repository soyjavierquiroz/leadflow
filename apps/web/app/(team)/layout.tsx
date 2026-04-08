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
    href: "/team/leads",
    label: "Leads",
    description: "Bandeja operativa para seguimiento, reminders y cierre.",
  },
  {
    href: "/team/members",
    label: "Equipo",
    description: "Licencias activas, invitados y control operativo del squad.",
  },
  {
    href: "/team/wheels",
    label: "Ruedas",
    description: "Bolsa comun activa, buy-ins y ocupacion de asientos.",
  },
  {
    href: "/team/pools",
    label: "Pools",
    description: "Cobertura de rotación y fallback de handoff.",
  },
  {
    href: "/team/settings",
    label: "Ajustes",
    description: "Nombre, logo y dominio base del tenant.",
  },
  {
    href: "/team/profile",
    label: "Mi perfil",
    description: "Datos personales, móvil y contraseña.",
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
