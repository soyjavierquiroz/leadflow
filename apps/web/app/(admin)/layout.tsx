import { AppShellLayout } from "@/components/app-shell/app-shell-layout";
import { requireRole } from "@/lib/auth";
import { getAppShellSnapshot } from "@/lib/app-shell/data";

const adminNav = [
  {
    href: "/admin",
    label: "Dashboard",
    description: "Pulso general de plataforma, equipos y funnel runtime.",
  },
  {
    href: "/admin/tenants",
    label: "Tenants",
    description: "Provisioning, seats y lectura global de agencias cliente.",
  },
  {
    href: "/admin/teams",
    label: "Teams",
    description: "Capacidad instalada, ownership y cobertura operativa.",
  },
  {
    href: "/admin/templates",
    label: "Templates",
    description: "Catálogo base que define la experiencia pública.",
  },
  {
    href: "/admin/publications",
    label: "Publicaciones",
    description: "Qué funnels ya están expuestos y por dónde salen.",
  },
];

export default async function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  await requireRole("SUPER_ADMIN");
  const snapshot = await getAppShellSnapshot();

  return (
      <AppShellLayout
        areaLabel="Super Admin"
        areaDescription="Panel de plataforma para entender catálogo, equipos, publicaciones y salud del rollout sin perder el contexto comercial."
        topBarTitle="Plataforma Leadflow"
        personaLabel="Super Admin"
      workspaceName={snapshot.workspace.name}
      sourceMode={snapshot.sourceMode}
      currentUser={snapshot.currentUser}
      nav={adminNav}
    >
      {children}
    </AppShellLayout>
  );
}
