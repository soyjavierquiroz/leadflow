"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/components/app-shell/theme-provider";

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";

  return (
    <button
      type="button"
      role="switch"
      aria-checked={isDark}
      aria-label={isDark ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
      onClick={toggleTheme}
      className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-app-border bg-app-surface text-app-text shadow-[0_12px_32px_rgba(15,23,42,0.08)] transition hover:border-app-border-strong hover:bg-app-surface-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-app-accent-soft"
    >
      <span
        className={`flex h-8 w-8 items-center justify-center rounded-full border transition ${
          isDark
            ? "border-app-border bg-app-text text-app-bg"
            : "border-app-border bg-app-accent-soft text-app-accent"
        }`}
      >
        {isDark ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
      </span>
    </button>
  );
}
