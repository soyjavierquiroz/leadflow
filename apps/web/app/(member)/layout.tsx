import { AppShellLayout } from "@/components/app-shell/app-shell-layout";
import { LogoutButton } from "@/components/auth/logout-button";
import { requireRole } from "@/lib/auth";

const memberNav = [
  {
    href: "/member",
    label: "Dashboard",
    description: "Mi dia de trabajo, handoffs nuevos y carga activa.",
  },
  {
    href: "/member/leads",
    label: "Leads",
    description: "Bandeja diaria para seguimiento, prioridad y cierre.",
  },
  {
    href: "/member/profile",
    label: "Perfil",
    description: "Datos de trabajo y configuracion del sponsor.",
  },
  {
    href: "/member/channel",
    label: "Canal",
    description: "Conexion de WhatsApp y readiness del canal real.",
  },
];

export default async function MemberLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const user = await requireRole("MEMBER");

  if (user.sponsor?.isActive === false) {
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
      areaLabel="Sponsor / Member"
      areaDescription="Workspace personal del sponsor para aceptar handoffs, hacer seguimiento y sostener su canal de atencion."
      topBarTitle={user.sponsor?.displayName ?? user.fullName}
      personaLabel="Sponsor / Member"
      workspaceName={user.workspace?.name ?? "Leadflow"}
      currentUser={user}
      nav={memberNav}
    >
      {children}
    </AppShellLayout>
  );
}
