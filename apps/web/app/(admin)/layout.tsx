import { AdminShellFrame } from "@/components/app-shell/admin-shell-frame";
import { requireRole } from "@/lib/auth";
import { getAppShellSnapshot } from "@/lib/app-shell/data";

const adminNav = [
  {
    href: "/admin",
    label: "Dashboard",
    icon: "layout-dashboard",
  },
  {
    href: "/admin/tenants",
    label: "Tenants",
    icon: "building-2",
  },
  {
    href: "/admin/teams",
    label: "Teams",
    icon: "users",
  },
  {
    href: "/admin/templates",
    label: "Templates",
    icon: "layout-template",
  },
  {
    href: "/admin/estructuras",
    label: "Estructuras",
    icon: "network",
  },
  {
    href: "/admin/publications",
    label: "Publicaciones",
    icon: "radio-tower",
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
      areaDescription="Panel principal de plataforma."
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
