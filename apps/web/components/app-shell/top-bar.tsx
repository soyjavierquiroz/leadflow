"use client";

import { User } from "lucide-react";
import Link from "next/link";
import { LogoutButton } from "@/components/auth/logout-button";
import { ThemeToggle } from "@/components/app-shell/theme-toggle";
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

const getCompactUserName = (fullName: string | null | undefined) => {
  const normalizedName = fullName?.trim();

  if (!normalizedName) {
    return "Sin sesión";
  }

  if (normalizedName.length <= 18) {
    return normalizedName;
  }

  return normalizedName.split(/\s+/)[0] || normalizedName;
};

export function TopBar({
  title,
  workspaceName,
  personaLabel,
  currentUser,
  workspaceSwitcher,
}: TopBarProps) {
  const compactUserName = getCompactUserName(currentUser?.fullName);

  return (
    <header className="sticky top-0 z-20 border-b border-app-border bg-app-surface px-4 py-3 shadow-[0_8px_30px_rgba(15,23,42,0.05)] backdrop-blur md:px-6 lg:px-8">
      <div className="flex flex-col gap-3 md:grid md:grid-cols-[minmax(0,1fr)_auto] md:items-center md:gap-4">
        <div className="min-w-0">
          <p className="truncate text-xs font-semibold uppercase tracking-[0.24em] text-app-text-soft">
            {personaLabel}
          </p>
          <h1 className="mt-1 truncate text-lg font-semibold text-app-text md:text-xl">
            {title}
          </h1>
          <p className="mt-1 truncate text-sm text-app-text-muted">
            {workspaceName} · superficie operativa activa
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-2.5 md:flex-nowrap md:justify-end">
          <ThemeToggle />

          {workspaceSwitcher ? (
            <div className="rounded-[1.2rem] border border-app-border bg-app-surface p-1 shadow-[0_12px_32px_rgba(15,23,42,0.06)]">
              <div className="flex flex-nowrap gap-1">
                {workspaceSwitcher.options.map((option) => {
                  const isActive = option.mode === workspaceSwitcher.activeMode;

                  return (
                    <Link
                      key={option.mode}
                      href={option.href}
                      aria-current={isActive ? "page" : undefined}
                      className={`whitespace-nowrap rounded-[0.95rem] px-3 py-2 text-sm font-semibold transition ${
                        isActive
                          ? "bg-app-text text-app-bg shadow-[0_10px_24px_rgba(15,23,42,0.18)]"
                          : "text-app-text-muted hover:bg-app-surface-muted"
                      }`}
                    >
                      {option.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          ) : null}

          <div className="flex min-w-0 max-w-[220px] items-center gap-2 rounded-full border border-app-border bg-app-surface px-3 py-1.5 shadow-[0_12px_32px_rgba(15,23,42,0.05)] sm:max-w-[260px]">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-app-surface-muted text-app-text-soft">
              <User className="h-4 w-4" />
            </span>
            <div className="min-w-0 text-left leading-tight">
              <p className="truncate text-sm font-semibold text-app-text">
                {compactUserName}
              </p>
              <p className="truncate text-xs text-app-text-soft">
                {currentUser?.email ?? "No autenticado"}
              </p>
            </div>
          </div>

          <LogoutButton />
        </div>
      </div>
    </header>
  );
}
