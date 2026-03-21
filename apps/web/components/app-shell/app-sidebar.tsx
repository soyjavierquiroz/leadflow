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

  return (
    <aside className="border-b border-white/60 bg-slate-950 px-5 py-6 text-slate-100 lg:min-h-screen lg:border-b-0 lg:border-r lg:border-r-white/10">
      <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.32em] text-slate-400">
          Leadflow
        </p>
        <h2 className="mt-3 text-2xl font-semibold tracking-tight">
          {areaLabel}
        </h2>
        <p className="mt-3 text-sm leading-6 text-slate-300">
          {areaDescription}
        </p>
      </div>
      <nav className="mt-6 space-y-2">
        {nav.map((item) => {
          const match = item.match ?? item.href;
          const isActive =
            pathname === item.href ||
            (pathname.startsWith(`${match}/`) && match !== "/");

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`block rounded-2xl border px-4 py-3 transition ${
                isActive
                  ? "border-white/20 bg-white text-slate-950"
                  : "border-white/10 bg-white/5 text-slate-200 hover:border-white/20 hover:bg-white/10"
              }`}
            >
              <p className="text-sm font-semibold">{item.label}</p>
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
    </aside>
  );
}
