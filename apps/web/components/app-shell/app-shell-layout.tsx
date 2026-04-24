"use client";

import type { ReactNode } from "react";
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
  areaDescription,
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
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,var(--app-accent-soft),transparent_28%),linear-gradient(180deg,var(--app-bg-elevated)_0%,var(--app-bg)_100%)]">
      <div className="lg:grid lg:min-h-screen lg:grid-cols-[290px_minmax(0,1fr)]">
        <AppSidebar
          areaLabel={areaLabel}
          areaDescription={areaDescription}
          nav={nav}
          navSections={navSections}
          statusBadge={sidebarStatusBadge}
        />
        <div className="min-w-0">
          <TopBar
            title={topBarTitle}
            workspaceName={workspaceName}
            personaLabel={personaLabel}
            sourceMode={sourceMode}
            currentUser={currentUser}
            workspaceSwitcher={workspaceSwitcher}
          />
          <main className="flex w-full flex-col items-start px-5 py-6 text-left md:px-8 md:py-8">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
