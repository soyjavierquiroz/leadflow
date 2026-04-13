import { AdminShellFrame } from "@/components/app-shell/admin-shell-frame";
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
    href: "/admin/estructuras",
    label: "Estructuras",
    description: "Registro visual de core layouts para catálogo interno y builder.",
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
    <AdminShellFrame
      areaLabel="Super Admin"
      areaDescription="Panel de plataforma para entender catálogo, equipos, publicaciones y salud del rollout sin perder el contexto comercial."
      topBarTitle="Plataforma Leadflow"
      personaLabel="Super Admin"
      workspaceName={snapshot.workspace.name}
      sourceMode={snapshot.sourceMode}
      currentUser={snapshot.currentUser}
      nav={adminNav}
    >
      <div className="flex w-full flex-col items-start text-left">{children}</div>
    </AdminShellFrame>
  );
}
