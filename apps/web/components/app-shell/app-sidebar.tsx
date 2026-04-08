"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ShellNavItem } from "@/lib/app-shell/types";

type AppSidebarProps = {
  areaLabel: string;
  areaDescription: string;
  nav: ShellNavItem[];
};

export function AppSidebar({
  areaLabel,
  areaDescription,
  nav,
}: AppSidebarProps) {
  const pathname = usePathname();
  const hasStructuresLink = nav.some(
    (candidate) => candidate.href === "/admin/structures",
  );
  const resolvedNav =
    areaLabel === "Super Admin"
      ? nav.reduce<ShellNavItem[]>((items, item) => {
          items.push(item);

          if (item.href === "/admin/templates" && !hasStructuresLink) {
            items.push({
              href: "/admin/structures",
              label: "Structures",
              description:
                "Registro visual de core layouts para catálogo interno y builder.",
            });
          }

          return items;
        }, [])
      : nav;

  return (
    <aside className="border-b border-white/60 bg-[linear-gradient(180deg,_#020617_0%,_#0f172a_42%,_#111827_100%)] px-5 py-6 text-slate-100 lg:min-h-screen lg:border-b-0 lg:border-r lg:border-r-white/10">
      <div className="rounded-[2rem] border border-white/10 bg-[radial-gradient(circle_at_top_left,_rgba(45,212,191,0.18),_transparent_42%),linear-gradient(180deg,_rgba(255,255,255,0.08)_0%,_rgba(255,255,255,0.03)_100%)] p-5 shadow-[0_24px_60px_rgba(2,6,23,0.32)]">
        <p className="text-xs font-semibold uppercase tracking-[0.32em] text-teal-300">
          Leadflow OS
        </p>
        <h2 className="mt-3 text-2xl font-semibold tracking-tight text-white">
          {areaLabel}
        </h2>
        <p className="mt-3 text-sm leading-6 text-slate-300">
          {areaDescription}
        </p>

        <div className="mt-5 rounded-3xl border border-white/10 bg-slate-950/40 px-4 py-4">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">
            Objetivo del rol
          </p>
          <p className="mt-2 text-sm leading-6 text-slate-200">
            Usa esta navegación para entender el estado actual, detectar bloqueos y mover la operación al siguiente paso.
          </p>
        </div>
      </div>

      <div className="mt-6">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">
          Modulos
        </p>
        <p className="mt-2 text-sm text-slate-400">
          Lo importante de esta superficie, ordenado para trabajo diario.
        </p>
      </div>

      <nav className="mt-4 space-y-2">
        {resolvedNav.map((item) => {
          const match = item.match ?? item.href;
          const isActive =
            pathname === item.href ||
            (pathname.startsWith(`${match}/`) && match !== "/");

          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive ? "page" : undefined}
              className={`block rounded-[1.35rem] border px-4 py-3 transition ${
                isActive
                  ? "border-teal-300/40 bg-white text-slate-950 shadow-[0_16px_40px_rgba(15,23,42,0.2)]"
                  : "border-white/10 bg-white/5 text-slate-200 hover:border-white/20 hover:bg-white/10"
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span
                    className={`h-8 w-1 rounded-full ${
                      isActive ? "bg-slate-950" : "bg-white/10"
                    }`}
                  />
                  <p className="text-sm font-semibold">{item.label}</p>
                </div>
                {isActive ? (
                  <span className="rounded-full bg-slate-950 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-white">
                    Actual
                  </span>
                ) : null}
              </div>
              <p
                className={`mt-1 text-xs leading-5 ${
                  isActive ? "text-slate-600" : "text-slate-400"
                }`}
              >
                {item.description}
              </p>
            </Link>
          );
        })}
      </nav>

      <div className="mt-6 rounded-3xl border border-white/10 bg-white/5 px-4 py-4 text-sm leading-6 text-slate-300">
        La navegacion lateral ya no habla solo de modulos tecnicos: busca orientar la operacion, la capacidad y el seguimiento del rol.
      </div>
    </aside>
  );
}
