"use client";

import Link from "next/link";
import { LogoutButton } from "@/components/auth/logout-button";
import type { AuthenticatedAppUser } from "@/lib/auth.types";
import type {
  DataSourceMode,
  WorkspaceViewSwitcherOption,
  WorkspaceViewMode,
} from "@/lib/app-shell/types";

type WorkspaceSwitcherProps = {
  activeMode: WorkspaceViewMode;
  options: WorkspaceViewSwitcherOption[];
};

type TopBarProps = {
  title: string;
  workspaceName: string;
  personaLabel: string;
  sourceMode?: DataSourceMode;
  currentUser: AuthenticatedAppUser | null;
  workspaceSwitcher?: WorkspaceSwitcherProps;
};

export function TopBar({
  title,
  workspaceName,
  personaLabel,
  currentUser,
  workspaceSwitcher,
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
          {workspaceSwitcher ? (
            <div className="rounded-[1.6rem] border border-slate-200 bg-white p-1.5 shadow-sm">
              <p className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                Workspace
              </p>
              <div className="flex flex-wrap gap-1">
                {workspaceSwitcher.options.map((option) => {
                  const isActive = option.mode === workspaceSwitcher.activeMode;

                  return (
                    <Link
                      key={option.mode}
                      href={option.href}
                      aria-current={isActive ? "page" : undefined}
                      className={`min-w-[170px] rounded-[1rem] px-3 py-2 text-left transition ${
                        isActive
                          ? "bg-slate-950 text-white shadow-[0_10px_24px_rgba(15,23,42,0.18)]"
                          : "text-slate-700 hover:bg-slate-100"
                      }`}
                    >
                      <p className="text-sm font-semibold">{option.label}</p>
                      <p
                        className={`mt-1 text-xs leading-5 ${
                          isActive ? "text-slate-300" : "text-slate-500"
                        }`}
                      >
                        {option.description}
                      </p>
                    </Link>
                  );
                })}
              </div>
            </div>
          ) : null}

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
