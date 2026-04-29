"use client";

import { usePathname } from "next/navigation";
import {
  AppShellLayout,
  type AppShellLayoutProps,
} from "@/components/app-shell/app-shell-layout";

const chromeFreeAdminRoutes = new Set(["/admin/preview"]);

const isChromeFreeAdminRoute = (pathname: string) =>
  chromeFreeAdminRoutes.has(pathname) ||
  /^\/admin\/tenants\/[^/]+\/funnels\/[^/]+\/builder$/.test(pathname);

export function AdminShellFrame(props: AppShellLayoutProps) {
  const pathname = usePathname();

  if (isChromeFreeAdminRoute(pathname)) {
    return <>{props.children}</>;
  }

  return <AppShellLayout {...props} />;
}
