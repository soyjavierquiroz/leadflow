"use client";

import { X } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { AppSidebar } from "@/components/app-shell/app-sidebar";
import { TopBar } from "@/components/app-shell/top-bar";
import type { AuthenticatedAppUser } from "@/lib/auth.types";
import type {
  DataSourceMode,
  ShellNavItem,
  ShellNavSection,
  SidebarStatusBadge,
  WorkspaceViewSwitcherOption,
  WorkspaceViewMode,
} from "@/lib/app-shell/types";

export type AppShellWorkspaceSwitcher = {
  activeMode: WorkspaceViewMode;
  options: WorkspaceViewSwitcherOption[];
};

export type AppShellLayoutProps = {
  areaLabel: string;
  areaDescription: string;
  topBarTitle: string;
  personaLabel: string;
  workspaceName: string;
  sourceMode?: DataSourceMode;
  currentUser: AuthenticatedAppUser | null;
  nav: ShellNavItem[];
  navSections?: ShellNavSection[];
  sidebarStatusBadge?: SidebarStatusBadge;
  workspaceSwitcher?: AppShellWorkspaceSwitcher;
  children: ReactNode;
};

export function AppShellLayout({
  areaLabel,
  areaDescription: _areaDescription,
  topBarTitle,
  personaLabel,
  workspaceName,
  sourceMode,
  currentUser,
  nav,
  navSections,
  sidebarStatusBadge,
  workspaceSwitcher,
  children,
}: AppShellLayoutProps) {
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);

  useEffect(() => {
    if (!isMobileNavOpen) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsMobileNavOpen(false);
      }
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isMobileNavOpen]);

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,var(--app-accent-soft),transparent_28%),linear-gradient(180deg,var(--app-bg-elevated)_0%,var(--app-bg)_100%)]">
      <div className="md:grid md:min-h-screen md:grid-cols-[248px_minmax(0,1fr)] lg:grid-cols-[264px_minmax(0,1fr)]">
        <AppSidebar
          areaLabel={areaLabel}
          nav={nav}
          navSections={navSections}
          statusBadge={sidebarStatusBadge}
          className="hidden md:flex"
        />
        <div className="min-w-0">
          <TopBar
            title={topBarTitle}
            workspaceName={workspaceName}
            personaLabel={personaLabel}
            sourceMode={sourceMode}
            currentUser={currentUser}
            workspaceSwitcher={workspaceSwitcher}
            onMenuClick={() => setIsMobileNavOpen(true)}
          />
          <main className="flex w-full flex-col items-start p-4 text-left md:p-6 lg:p-8">
            {children}
          </main>
        </div>
      </div>

      {isMobileNavOpen ? (
        <div
          className="fixed inset-0 z-40 bg-slate-950/45 backdrop-blur-sm md:hidden"
          onClick={() => setIsMobileNavOpen(false)}
          aria-hidden="true"
        />
      ) : null}

      {isMobileNavOpen ? (
        <div
          className="fixed inset-y-0 left-0 z-50 w-[86vw] max-w-[320px] md:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Navegación"
        >
          <div className="flex h-full flex-col">
            <div className="flex items-center justify-end px-4 pt-4">
              <button
                type="button"
                onClick={() => setIsMobileNavOpen(false)}
                className="flex size-10 items-center justify-center rounded-2xl border border-app-shell-border bg-app-shell-surface text-app-shell-text transition hover:bg-[color:color-mix(in_srgb,var(--app-shell-text)_8%,transparent)]"
                aria-label="Cerrar navegación"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <AppSidebar
              areaLabel={areaLabel}
              nav={nav}
              navSections={navSections}
              statusBadge={sidebarStatusBadge}
              className="flex h-full overflow-y-auto pb-4"
              onNavigate={() => setIsMobileNavOpen(false)}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
