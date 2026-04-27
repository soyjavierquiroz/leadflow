import { AppShellLayout } from "@/components/app-shell/app-shell-layout";
import { isHybridOperationalAdmin, requireRole } from "@/lib/auth";
import { getAppShellSnapshot } from "@/lib/app-shell/data";
import type { WorkspaceViewSwitcherOption } from "@/lib/app-shell/types";

const teamNav = [
  {
    href: "/team",
    label: "Dashboard",
    icon: "layout-dashboard",
  },
  {
    href: "/team/leads",
    label: "Leads",
    icon: "inbox",
  },
  {
    href: "/team/members",
    label: "Equipo",
    icon: "users",
  },
  {
    href: "/team/wheels",
    label: "Ruedas",
    icon: "orbit",
  },
  {
    href: "/management/ai-config",
    label: "Configuración de IA",
    icon: "bot",
    match: "/management/ai-config",
  },
  {
    href: "/team/pools",
    label: "Pools",
    icon: "layers-3",
  },
  {
    href: "/team/settings",
    label: "Ajustes",
    icon: "settings",
  },
  {
    href: "/team/profile",
    label: "Mi perfil",
    icon: "user-round",
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
      areaDescription="Centro operativo del equipo."
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
