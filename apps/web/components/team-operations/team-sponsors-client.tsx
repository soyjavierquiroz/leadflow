"use client";

import { useState, useTransition } from "react";
import { EmptyState } from "@/components/app-shell/empty-state";
import { KpiCard } from "@/components/app-shell/kpi-card";
import { SectionHeader } from "@/components/app-shell/section-header";
import { SponsorCard } from "@/components/app-shell/sponsor-card";
import { OperationBanner } from "@/components/team-operations/operation-banner";
import type { AssignmentRecord, LeadView, SponsorRecord } from "@/lib/app-shell/types";
import { formatCompactNumber } from "@/lib/app-shell/utils";
import { teamOperationRequest } from "@/lib/team-operations";

type TeamSponsorsClientProps = {
  initialRows: SponsorRecord[];
  leadViews: LeadView[];
  assignments: AssignmentRecord[];
};

const buttonClassName =
  "rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60";

export function TeamSponsorsClient({
  initialRows,
  leadViews,
  assignments,
}: TeamSponsorsClientProps) {
  const [rows, setRows] = useState(initialRows);
  const [isPending, startTransition] = useTransition();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const resetMessages = () => {
    setErrorMessage(null);
    setSuccessMessage(null);
  };

  const handlePatch = (
    sponsorId: string,
    payload: {
      status?: "active" | "paused";
      availabilityStatus?: "available" | "paused" | "offline";
    },
  ) => {
    resetMessages();

    startTransition(async () => {
      try {
        const record = await teamOperationRequest<SponsorRecord>(`/sponsors/${sponsorId}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });

        setRows((current) =>
          current.map((item) => (item.id === sponsorId ? record : item)),
        );
        setSuccessMessage("Sponsor actualizado correctamente.");
      } catch (error) {
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "No pudimos actualizar el sponsor.",
        );
      }
    });
  };

  return (
    <div className="space-y-8">
      <SectionHeader
        eyebrow="Team Admin / Sponsors"
        title="Miembros operativos del team"
        description="El team admin ya puede pausar sponsors, reactivarlos y ajustar disponibilidad operativa sin entrar todavía en gestión avanzada de usuarios."
      />

      {errorMessage ? <OperationBanner tone="error" message={errorMessage} /> : null}
      {successMessage ? (
        <OperationBanner tone="success" message={successMessage} />
      ) : null}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Sponsors"
          value={formatCompactNumber(rows.length)}
          hint="Miembros ligados al team actual."
        />
        <KpiCard
          label="Disponibles"
          value={formatCompactNumber(
            rows.filter((item) => item.availabilityStatus === "available").length,
          )}
          hint="Capacidad actual para recibir handoffs."
        />
        <KpiCard
          label="Pausados"
          value={formatCompactNumber(rows.filter((item) => item.status === "paused").length)}
          hint="Sponsors desactivados temporalmente desde operaciones."
        />
        <KpiCard
          label="Portal habilitado"
          value={formatCompactNumber(
            rows.filter((item) => item.memberPortalEnabled).length,
          )}
          hint="Sponsors listos para usar la superficie member."
        />
      </section>

      {rows.length > 0 ? (
        <div className="grid gap-4 xl:grid-cols-2">
          {rows.map((sponsor) => (
            <SponsorCard
              key={sponsor.id}
              sponsor={sponsor}
              leadCount={leadViews.filter((item) => item.sponsorId === sponsor.id).length}
              assignmentCount={
                assignments.filter((item) => item.sponsorId === sponsor.id).length
              }
              actions={
                <>
                  <button
                    type="button"
                    onClick={() =>
                      handlePatch(sponsor.id, {
                        status: sponsor.status === "active" ? "paused" : "active",
                      })
                    }
                    disabled={isPending}
                    className={buttonClassName}
                  >
                    {sponsor.status === "active" ? "Pausar" : "Activar"}
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      handlePatch(sponsor.id, {
                        availabilityStatus: "available",
                      })
                    }
                    disabled={isPending}
                    className={buttonClassName}
                  >
                    Disponible
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      handlePatch(sponsor.id, {
                        availabilityStatus: "paused",
                      })
                    }
                    disabled={isPending}
                    className={buttonClassName}
                  >
                    En pausa
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      handlePatch(sponsor.id, {
                        availabilityStatus: "offline",
                      })
                    }
                    disabled={isPending}
                    className={buttonClassName}
                  >
                    Offline
                  </button>
                </>
              }
            />
          ))}
        </div>
      ) : (
        <EmptyState
          title="Sin sponsors operativos"
          description="Cuando el team tenga miembros activos aparecerán aquí con una vista más clara de carga y disponibilidad."
        />
      )}
    </div>
  );
}
