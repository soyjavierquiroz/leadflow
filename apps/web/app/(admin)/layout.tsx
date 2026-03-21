import { AppShellLayout } from "@/components/app-shell/app-shell-layout";
import { getAppShellSnapshot } from "@/lib/app-shell/data";

const adminNav = [
  {
    href: "/admin",
    label: "Dashboard",
    description: "Salud de la plataforma y panorama general.",
  },
  {
    href: "/admin/teams",
    label: "Teams",
    description: "Ownership operativo y capacidad instalada.",
  },
  {
    href: "/admin/templates",
    label: "Templates",
    description: "Supervisión del catálogo JSON-driven.",
  },
  {
    href: "/admin/publications",
    label: "Publicaciones",
    description: "Bindings activos por host y path.",
  },
];

export default async function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const snapshot = await getAppShellSnapshot();

  return (
    <AppShellLayout
      areaLabel="Super Admin"
      areaDescription="Gobierno estructural de templates, equipos, publicaciones y rollout operativo."
      topBarTitle="Plataforma Leadflow"
      personaLabel="Super Admin"
      workspaceName={snapshot.workspace.name}
      sourceMode={snapshot.sourceMode}
      nav={adminNav}
    >
      {children}
    </AppShellLayout>
  );
}
