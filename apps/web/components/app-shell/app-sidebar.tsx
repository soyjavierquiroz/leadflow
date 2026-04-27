"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bot } from "lucide-react";
import type {
  ShellNavItem,
  ShellNavSection,
  SidebarStatusBadge,
} from "@/lib/app-shell/types";

type AppSidebarProps = {
  areaLabel: string;
  areaDescription: string;
  nav: ShellNavItem[];
  navSections?: ShellNavSection[];
  statusBadge?: SidebarStatusBadge;
};

const normalizePathname = (value: string) =>
  value === "/" ? value : value.replace(/\/+$/, "");

const isTopLevelRoute = (value: string) =>
  normalizePathname(value).split("/").filter(Boolean).length === 1;

export function AppSidebar({
  areaLabel,
  areaDescription,
  nav,
  navSections,
  statusBadge,
}: AppSidebarProps) {
  const iconMap: Record<string, typeof Bot> = {
    bot: Bot,
  };
  const pathname = usePathname();
  const sections =
    navSections && navSections.length > 0
      ? navSections
      : [
          {
            title: "Modulos",
            description: "Lo importante de esta superficie, ordenado para trabajo diario.",
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
        className={`block rounded-[1.35rem] border px-4 py-3 transition ${
          isActive
            ? "border-app-accent bg-app-accent-soft text-app-shell-text shadow-[var(--ai-card-shadow)]"
            : "border-app-shell-border bg-app-shell-surface text-app-shell-text hover:border-app-shell-muted hover:bg-[color:color-mix(in_srgb,var(--app-shell-text)_10%,transparent)]"
        }`}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span
              className={`h-8 w-1 rounded-full ${
                isActive
                  ? "bg-app-accent"
                  : "bg-[color:color-mix(in_srgb,var(--app-shell-text)_12%,transparent)]"
              }`}
            />
            {Icon ? (
              <Icon
                className={`h-4 w-4 shrink-0 ${
                  isActive ? "text-app-accent" : "text-app-shell-muted"
                }`}
              />
            ) : null}
            <p className="text-sm font-semibold">{item.label}</p>
          </div>
          {isActive ? (
            <span className="rounded-full bg-app-accent px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-app-accent-contrast">
              Actual
            </span>
          ) : null}
        </div>
        <p
          className={`mt-1 text-xs leading-5 ${
            isActive ? "text-app-shell-text" : "text-app-shell-muted"
          }`}
        >
          {item.description}
        </p>
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
    <aside className="border-b border-app-shell-border bg-[linear-gradient(180deg,var(--app-shell-bg)_0%,var(--app-shell-bg-strong)_100%)] px-5 py-6 text-app-shell-text lg:min-h-screen lg:border-b-0 lg:border-r">
      <div className="rounded-[2rem] border border-app-shell-border bg-[radial-gradient(circle_at_top_left,var(--app-accent-soft),transparent_42%),linear-gradient(180deg,var(--app-shell-surface)_0%,var(--app-shell-bg-strong)_100%)] p-5 shadow-[var(--ai-panel-shadow)]">
        <p className="text-xs font-semibold uppercase tracking-[0.32em] text-app-accent">
          Leadflow OS
        </p>
        <h2 className="mt-3 text-2xl font-semibold tracking-tight text-app-shell-text">
          {areaLabel}
        </h2>
        <p className="mt-3 text-sm leading-6 text-app-shell-muted">
          {areaDescription}
        </p>

        <div className="mt-5 rounded-3xl border border-app-shell-border bg-[color:color-mix(in_srgb,var(--app-shell-text)_8%,transparent)] px-4 py-4">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-app-shell-muted">
            Objetivo del rol
          </p>
          <p className="mt-2 text-sm leading-6 text-app-shell-text">
            Usa esta navegación para entender el estado actual, detectar bloqueos y mover la operación al siguiente paso.
          </p>
        </div>

        {statusBadge ? (
          <div
            className={`mt-4 inline-flex items-center rounded-full border px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.22em] ${statusBadgeClassName}`}
          >
            {statusBadge.label}
          </div>
        ) : null}
      </div>

      <div className="mt-6 space-y-6">
        {sections.map((section, index) => (
          <section
            key={section.title}
            className={index === 0 ? undefined : "border-t border-app-shell-border pt-6"}
          >
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-app-shell-muted">
              {section.title}
            </p>
            {section.description ? (
              <p className="mt-2 text-sm text-app-shell-muted">
                {section.description}
              </p>
            ) : null}
            <nav className="mt-4 space-y-2">
              {section.items.map((item) => renderNavItem(item))}
            </nav>
          </section>
        ))}
      </div>

      <div className="mt-6 rounded-3xl border border-app-shell-border bg-app-shell-surface px-4 py-4 text-sm leading-6 text-app-shell-muted">
        La navegacion lateral ya no habla solo de modulos tecnicos: busca orientar la operacion, la capacidad y el seguimiento del rol.
      </div>
    </aside>
  );
}
