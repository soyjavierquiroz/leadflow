import Link from "next/link";
import { ArrowLeft, LockKeyhole } from "lucide-react";

type FunnelPreviewUnavailableProps = {
  mode: "admin" | "member";
  backHref: string;
};

export function FunnelPreviewUnavailable({
  mode,
  backHref,
}: FunnelPreviewUnavailableProps) {
  return (
    <main className="min-h-screen bg-app-bg px-4 py-10 text-app-text md:px-6">
      <section className="mx-auto flex min-h-[70vh] max-w-3xl flex-col justify-center rounded-lg border border-app-border bg-app-surface p-6">
        <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-app-warning-border bg-app-warning-bg text-app-warning-text">
          <LockKeyhole className="h-5 w-5" />
        </div>
        <h1 className="mt-5 text-3xl font-semibold tracking-tight">
          Este funnel aún no tiene un Master Funnel asociado.
        </h1>
        <p className="mt-3 text-sm leading-7 text-app-text-muted">
          {mode === "admin"
            ? "Asocia un Master Funnel para habilitar preview real, activación y clonación."
            : "Este funnel estará disponible pronto."}
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href={backHref}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-app-border bg-app-card px-4 py-2.5 text-sm font-semibold text-app-text transition hover:border-app-border-strong hover:bg-app-surface-muted"
          >
            <ArrowLeft className="h-4 w-4" />
            Volver
          </Link>
          {mode === "admin" ? (
            <Link
              href={backHref}
              className="inline-flex items-center justify-center rounded-lg bg-app-accent px-4 py-2.5 text-sm font-semibold text-app-accent-contrast transition hover:opacity-90"
            >
              Asociar Master Funnel
            </Link>
          ) : (
            <span className="inline-flex items-center justify-center rounded-lg border border-app-border bg-app-card px-4 py-2.5 text-sm font-semibold text-app-text-muted">
              Este funnel estará disponible pronto.
            </span>
          )}
        </div>
      </section>
    </main>
  );
}

