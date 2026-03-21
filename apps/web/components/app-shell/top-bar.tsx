import { LogoutButton } from "@/components/auth/logout-button";
import type { AuthenticatedAppUser } from "@/lib/auth";
import type { DataSourceMode } from "@/lib/app-shell/types";

type TopBarProps = {
  title: string;
  workspaceName: string;
  personaLabel: string;
  sourceMode: DataSourceMode;
  currentUser: AuthenticatedAppUser | null;
};

const sourceLabel = {
  live: "Datos reales",
  hybrid: "Datos mixtos",
  mock: "Modo mock",
} satisfies Record<DataSourceMode, string>;

export function TopBar({
  title,
  workspaceName,
  personaLabel,
  sourceMode,
  currentUser,
}: TopBarProps) {
  return (
    <header className="sticky top-0 z-20 border-b border-white/70 bg-white/80 px-5 py-4 backdrop-blur md:px-8">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
            {personaLabel}
          </p>
          <h1 className="mt-1 text-lg font-semibold text-slate-950">{title}</h1>
          <p className="text-sm text-slate-600">{workspaceName}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <span className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600">
            {currentUser?.fullName ?? "Sin sesión"}
          </span>
          <span className="rounded-full border border-slate-200 bg-slate-950 px-3 py-1.5 text-xs font-semibold text-white">
            {sourceLabel[sourceMode]}
          </span>
          <LogoutButton />
        </div>
      </div>
    </header>
  );
}
