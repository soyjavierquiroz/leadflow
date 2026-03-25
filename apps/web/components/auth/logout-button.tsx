"use client";

import { useState } from "react";
import { logoutWithSession } from "@/lib/auth-client";

export function LogoutButton() {
  const [isPending, setIsPending] = useState(false);

  const handleLogout = async () => {
    if (isPending) {
      return;
    }

    setIsPending(true);

    try {
      await logoutWithSession();
      window.location.assign("/login");
    } catch {
      setIsPending(false);
    }
  };

  return (
    <button
      type="button"
      onClick={() => void handleLogout()}
      disabled={isPending}
      className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {isPending ? "Saliendo..." : "Cerrar sesión"}
    </button>
  );
}
