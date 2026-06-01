"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Bot,
  BriefcaseBusiness,
  Building2,
  Inbox,
  Layers3,
  LayoutDashboard,
  LayoutTemplate,
  Link2,
  Network,
  Orbit,
  RadioTower,
  Settings,
  UserRound,
  Users,
} from "lucide-react";
import type {
  ShellNavItem,
  ShellNavSection,
  SidebarStatusBadge,
} from "@/lib/app-shell/types";

type AppSidebarProps = {
  id?: string;
  areaLabel: string;
  nav: ShellNavItem[];
  navSections?: ShellNavSection[];
  statusBadge?: SidebarStatusBadge;
  collapsed?: boolean;
  className?: string;
  onNavigate?: () => void;
};

const iconMap: Record<string, typeof Bot> = {
  "bar-chart-3": BarChart3,
  bot: Bot,
  "briefcase-business": BriefcaseBusiness,
  "building-2": Building2,
  inbox: Inbox,
  "layers-3": Layers3,
  "layout-dashboard": LayoutDashboard,
  "layout-template": LayoutTemplate,
  "link-2": Link2,
  network: Network,
  orbit: Orbit,
  "radio-tower": RadioTower,
  settings: Settings,
  "user-round": UserRound,
  users: Users,
};

const normalizePathname = (value: string) =>
  value === "/" ? value : value.replace(/\/+$/, "");

const isTopLevelRoute = (value: string) =>
  normalizePathname(value).split("/").filter(Boolean).length === 1;

export function AppSidebar({
  id,
  areaLabel,
  nav,
  navSections,
  statusBadge,
  collapsed = false,
  className,
  onNavigate,
}: AppSidebarProps) {
  const pathname = usePathname();
  const sections =
    navSections && navSections.length > 0
      ? navSections
      : [
          {
            title: "Navegación",
            items: nav,
          },
        ];

  const renderNavItem = (item: ShellNavItem) => {
    const currentPath = normalizePathname(pathname);
    const href = normalizePathname(item.href);
    const match = normalizePathname(item.match ?? item.href);
    const exact = item.exact ?? isTopLevelRoute(match);
    const isActive =
      currentPath === href ||
      (!exact && currentPath.startsWith(`${match}/`) && match !== "/");
    const Icon = item.icon ? iconMap[item.icon] ?? null : null;

    return (
      <Link
        key={item.href}
        href={item.href}
        aria-current={isActive ? "page" : undefined}
        aria-label={collapsed ? item.label : undefined}
        title={collapsed ? item.label : undefined}
        onClick={onNavigate}
        className={`relative flex rounded-[1.25rem] border transition ${
          collapsed
            ? "h-12 items-center justify-center px-0 py-0"
            : "block px-4 py-3"
        } ${
          isActive
            ? "border-app-accent bg-app-accent-soft text-app-shell-text shadow-[var(--ai-card-shadow)]"
            : "border-app-shell-border bg-app-shell-surface text-app-shell-text hover:border-app-shell-muted hover:bg-[color:color-mix(in_srgb,var(--app-shell-text)_10%,transparent)]"
        }`}
      >
        <div
          className={`flex w-full items-center ${
            collapsed ? "justify-center" : "justify-between gap-3"
          }`}
        >
          <div
            className={`flex items-center ${
              collapsed ? "justify-center" : "gap-3"
            }`}
          >
            <span
              className={`flex size-9 items-center justify-center rounded-2xl border ${
                isActive
                  ? "border-app-accent bg-app-accent text-app-accent-contrast"
                  : "border-app-shell-border bg-[color:color-mix(in_srgb,var(--app-shell-text)_6%,transparent)] text-app-shell-muted"
              }`}
            >
              {Icon ? <Icon className="h-4 w-4 shrink-0" /> : null}
            </span>
            <span className={collapsed ? "sr-only" : "text-sm font-semibold"}>
              {item.label}
            </span>
          </div>
          {isActive ? (
            <span
              className={
                collapsed
                  ? "absolute right-2 top-1/2 h-2 w-2 -translate-y-1/2 rounded-full bg-app-accent"
                  : "h-2.5 w-2.5 rounded-full bg-app-accent"
              }
            />
          ) : null}
        </div>
      </Link>
    );
  };

  const statusBadgeClassName =
    statusBadge?.tone === "amber"
      ? "border-app-warning-border bg-app-warning-bg text-app-warning-text"
      : statusBadge?.tone === "teal"
        ? "border-app-accent bg-app-accent-soft text-app-accent"
        : "border-app-shell-border bg-[color:color-mix(in_srgb,var(--app-shell-text)_8%,transparent)] text-app-shell-text";

  return (
    <aside
      id={id}
      aria-label={`${areaLabel} navegación`}
      className={`border-r border-app-shell-border bg-[linear-gradient(180deg,var(--app-shell-bg)_0%,var(--app-shell-bg-strong)_100%)] py-5 text-app-shell-text ${
        collapsed ? "px-3" : "px-4"
      } ${className ?? ""}`}
    >
      <div className="flex min-h-full w-full flex-col">
        <div
          className={`rounded-[1.75rem] border border-app-shell-border bg-[radial-gradient(circle_at_top_left,var(--app-accent-soft),transparent_42%),linear-gradient(180deg,var(--app-shell-surface)_0%,var(--app-shell-bg-strong)_100%)] shadow-[var(--ai-panel-shadow)] ${
            collapsed
              ? "flex aspect-square items-center justify-center p-0"
              : "p-4"
          }`}
          title={collapsed ? `${areaLabel} - Leadflow OS` : undefined}
        >
          <div
            className={`flex items-center justify-center rounded-2xl border border-app-accent bg-app-accent text-app-accent-contrast ${
              collapsed ? "size-10" : "hidden"
            }`}
            aria-hidden="true"
          >
            <LayoutDashboard className="h-5 w-5" />
          </div>
          <div className={collapsed ? "sr-only" : undefined}>
            <p className="text-xs font-semibold uppercase tracking-[0.32em] text-app-accent">
              Leadflow OS
            </p>
            <h2 className="mt-3 text-xl font-semibold tracking-tight text-app-shell-text">
              {areaLabel}
            </h2>
          </div>

          {statusBadge && !collapsed ? (
            <div
              className={`mt-4 inline-flex items-center rounded-full border px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.22em] ${statusBadgeClassName}`}
            >
              {statusBadge.label}
            </div>
          ) : null}
        </div>

        <div className="mt-5 flex-1 space-y-5">
          {sections.map((section, index) => (
            <section
              key={section.title}
              className={
                index === 0 ? undefined : "border-t border-app-shell-border pt-5"
              }
            >
              <p
                className={
                  collapsed
                    ? "sr-only"
                    : "text-xs font-semibold uppercase tracking-[0.3em] text-app-shell-muted"
                }
              >
                {section.title}
              </p>
              <nav className={`${collapsed ? "mt-0" : "mt-3"} space-y-2`}>
                {section.items.map((item) => renderNavItem(item))}
              </nav>
            </section>
          ))}
        </div>
      </div>
    </aside>
  );
}
