import { AppShellLayout } from "@/components/app-shell/app-shell-layout";
import { LogoutButton } from "@/components/auth/logout-button";
import {
  canAccessOperationalView,
  isHybridOperationalAdmin,
  requireOperationalViewUser,
} from "@/lib/auth";
import type {
  ShellNavItem,
  ShellNavSection,
  WorkspaceViewSwitcherOption,
} from "@/lib/app-shell/types";

const memberNav: ShellNavItem[] = [
  {
    href: "/member",
    label: "Dashboard",
    description: "Mis metricas comerciales, handoffs nuevos y carga activa.",
  },
  {
    href: "/member/leads",
    label: "Leads",
    description: "Solo mis leads asignados para seguimiento, prioridad y cierre.",
  },
  {
    href: "/member/profile",
    label: "Perfil",
    description: "Datos de trabajo y configuracion del sponsor.",
  },
  {
    href: "/member/profile#blacklist-access",
    label: "Blacklist",
    description: "Acceso a la lista de proteccion desde Kurukin Hub.",
  },
];

const workspaceSwitcherOptions: WorkspaceViewSwitcherOption[] = [
  {
    href: "/team",
    label: "Vista de Gestión",
    description: "Capacidad, equipo y operación global del tenant.",
    mode: "management",
  },
  {
    href: "/member",
    label: "Vista de Operación",
    description: "Tus leads, tu sponsor y tu jornada comercial.",
    mode: "operations",
  },
];

export default async function MemberLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const user = await requireOperationalViewUser();
  const isHybridAdmin = isHybridOperationalAdmin(user);
  const isMemberUser = user.role === "MEMBER";
  const canSeeOperationalLinks = canAccessOperationalView(user);
  const operationalNav = canSeeOperationalLinks ? memberNav : [];

  const navSections: ShellNavSection[] = [];

  if (isHybridAdmin) {
    navSections.push({
      title: "Gestion de Equipo",
      description:
        "Tu cockpit de jefe para licencias, miembros, pools y control administrativo del tenant.",
      items: [
        {
          href: "/team",
          label: "Dashboard de Gestión",
          description:
            "Resumen del equipo, capacidad activa y decisiones operativas globales.",
        },
      ],
    });
  }

  if (isMemberUser || isHybridAdmin) {
    navSections.push({
      title: "Mi Operacion",
      description: isHybridAdmin
        ? "Tu espacio personal como asesor: leads, perfil y acceso operativo sin cerrar sesión."
        : "Tu espacio diario para atender leads, ajustar tu perfil y sostener tu operación.",
      items: operationalNav,
    });
  }

  if (user.role === "MEMBER" && user.sponsor?.isActive === false) {
    return (
      <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(251,191,36,0.18),_transparent_28%),linear-gradient(180deg,_#fff7ed_0%,_#fffbeb_45%,_#f8fafc_100%)]">
        <div className="mx-auto flex min-h-screen max-w-4xl items-center px-6 py-16">
          <section className="w-full overflow-hidden rounded-[32px] border border-amber-200 bg-white shadow-[0_30px_80px_rgba(120,53,15,0.12)]">
            <div className="border-b border-amber-100 bg-[linear-gradient(135deg,_#fff7ed_0%,_#fef3c7_100%)] px-8 py-8">
              <p className="text-sm font-semibold uppercase tracking-[0.28em] text-amber-700">
                Cuenta Pausada
              </p>
              <h1 className="mt-3 max-w-2xl text-3xl font-semibold tracking-tight text-slate-950">
                Tu cuenta está en pausa.
              </h1>
            </div>
            <div className="space-y-6 px-8 py-8 text-base text-slate-700">
              <p className="max-w-2xl leading-8">
                Solicita a tu Team Leader que active tu licencia para recibir
                leads y acceder al CRM.
              </p>
              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                <p className="font-medium text-slate-900">
                  Mientras tu licencia permanezca pausada:
                </p>
                <p className="mt-2 leading-7">
                  No podrás navegar por el CRM ni participar en la asignación
                  automática de leads.
                </p>
              </div>
              <div className="border-t border-amber-100 pt-2">
                <p className="mb-3 text-sm text-slate-600">
                  Si ingresaste con una sesión impersonada, cierra sesión para
                  volver a tu cuenta.
                </p>
                <LogoutButton />
              </div>
            </div>
          </section>
        </div>
      </main>
    );
  }

  return (
    <AppShellLayout
      areaLabel={isHybridAdmin ? "Team Admin / Operacion" : "Sponsor / Member"}
      areaDescription={
        isHybridAdmin
          ? "Freddy entra a su panel personal de ventas, atiende leads y vuelve a gestion cuando lo necesite."
          : "Workspace personal del sponsor para aceptar handoffs, hacer seguimiento y sostener su canal de atencion."
      }
      topBarTitle={user.sponsor?.displayName ?? user.fullName}
      personaLabel={
        isHybridAdmin ? "Team Admin / Modo Operador" : "Sponsor / Member"
      }
      workspaceName={user.workspace?.name ?? "Leadflow"}
      currentUser={user}
      nav={operationalNav}
      navSections={navSections}
      sidebarStatusBadge={
        isHybridAdmin
          ? {
              label: "Modo Operador",
              tone: "amber",
            }
          : undefined
      }
      workspaceSwitcher={
        isHybridAdmin
          ? {
              activeMode: "operations",
              options: workspaceSwitcherOptions,
            }
          : undefined
      }
    >
      {children}
    </AppShellLayout>
  );
}
