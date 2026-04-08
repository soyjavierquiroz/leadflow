"use client";

import { usePathname } from "next/navigation";
import {
  AppShellLayout,
  type AppShellLayoutProps,
} from "@/components/app-shell/app-shell-layout";

const chromeFreeAdminRoutes = new Set(["/admin/preview"]);

export function AdminShellFrame(props: AppShellLayoutProps) {
  const pathname = usePathname();

  if (chromeFreeAdminRoutes.has(pathname)) {
    return <>{props.children}</>;
  }

  return <AppShellLayout {...props} />;
}
