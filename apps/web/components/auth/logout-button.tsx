"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { webPublicConfig } from "@/lib/public-env";

export function LogoutButton() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const handleLogout = () => {
    startTransition(async () => {
      try {
        await fetch(`${webPublicConfig.urls.api}/v1/auth/logout`, {
          method: "POST",
          credentials: "include",
        });
      } finally {
        router.replace("/login");
        router.refresh();
      }
    });
  };

  return (
    <button
      type="button"
      onClick={handleLogout}
      disabled={isPending}
      className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {isPending ? "Saliendo..." : "Cerrar sesión"}
    </button>
  );
}
