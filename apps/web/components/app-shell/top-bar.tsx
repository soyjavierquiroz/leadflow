import { LogoutButton } from "@/components/auth/logout-button";
import type { AuthenticatedAppUser } from "@/lib/auth";
import type { DataSourceMode } from "@/lib/app-shell/types";

type TopBarProps = {
  title: string;
  workspaceName: string;
  personaLabel: string;
  sourceMode?: DataSourceMode;
  currentUser: AuthenticatedAppUser | null;
};

export function TopBar({
  title,
  workspaceName,
  personaLabel,
  currentUser,
}: TopBarProps) {
  return (
    <header className="sticky top-0 z-20 border-b border-white/70 bg-white/85 px-5 py-4 shadow-[0_8px_30px_rgba(15,23,42,0.04)] backdrop-blur md:px-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
            {personaLabel}
          </p>
          <h1 className="mt-1 text-lg font-semibold text-slate-950 md:text-xl">
            {title}
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            {workspaceName} · superficie operativa activa
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="rounded-full border border-slate-200 bg-white px-4 py-2 text-right shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
              Sesion
            </p>
            <p className="text-sm font-semibold text-slate-900">
              {currentUser?.fullName ?? "Sin sesión"}
            </p>
            <p className="text-xs text-slate-500">
              {currentUser?.email ?? "No autenticado"}
            </p>
          </div>

          <LogoutButton />
        </div>
      </div>
    </header>
  );
}
