import { AppShellLayout } from "@/components/app-shell/app-shell-layout";
import { isHybridOperationalAdmin, requireRole } from "@/lib/auth";
import { getAppShellSnapshot } from "@/lib/app-shell/data";
import type { WorkspaceViewSwitcherOption } from "@/lib/app-shell/types";

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
    href: "/management/ai-config",
    label: "Configuración de IA",
    description: "Prompt maestro, contextos y cierre del agente del equipo.",
    icon: "bot",
    match: "/management/ai-config",
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

const workspaceSwitcherOptions: WorkspaceViewSwitcherOption[] = [
  {
    href: "/team",
    label: "Vista de Gestión",
    description: "Capacidad, licencias, equipo y métricas globales.",
    mode: "management",
  },
  {
    href: "/member",
    label: "Vista de Operación",
    description: "Tus métricas comerciales, leads y sponsor personal.",
    mode: "operations",
  },
];

export default async function TeamLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const user = await requireRole("TEAM_ADMIN");
  const snapshot = await getAppShellSnapshot();
  const canOpenOperationalView = isHybridOperationalAdmin(user);

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
      workspaceSwitcher={
        canOpenOperationalView
          ? {
              activeMode: "management",
              options: workspaceSwitcherOptions,
            }
          : undefined
      }
    >
      {children}
    </AppShellLayout>
  );
}
