import type { ReactNode } from "react";
import { AppSidebar } from "@/components/app-shell/app-sidebar";
import { TopBar } from "@/components/app-shell/top-bar";
import type { DataSourceMode, ShellNavItem } from "@/lib/app-shell/types";

type AppShellLayoutProps = {
  areaLabel: string;
  areaDescription: string;
  topBarTitle: string;
  personaLabel: string;
  workspaceName: string;
  sourceMode: DataSourceMode;
  nav: ShellNavItem[];
  children: ReactNode;
};

export function AppShellLayout({
  areaLabel,
  areaDescription,
  topBarTitle,
  personaLabel,
  workspaceName,
  sourceMode,
  nav,
  children,
}: AppShellLayoutProps) {
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(148,163,184,0.18),_transparent_28%),linear-gradient(180deg,_#f8fafc_0%,_#e2e8f0_100%)]">
      <div className="lg:grid lg:min-h-screen lg:grid-cols-[290px_minmax(0,1fr)]">
        <AppSidebar
          areaLabel={areaLabel}
          areaDescription={areaDescription}
          nav={nav}
        />
        <div className="min-w-0">
          <TopBar
            title={topBarTitle}
            workspaceName={workspaceName}
            personaLabel={personaLabel}
            sourceMode={sourceMode}
          />
          <main className="px-5 py-6 md:px-8 md:py-8">{children}</main>
        </div>
      </div>
    </div>
  );
}
