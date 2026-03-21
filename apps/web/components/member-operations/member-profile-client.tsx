"use client";

import { useState } from "react";
import { KpiCard } from "@/components/app-shell/kpi-card";
import { SectionHeader } from "@/components/app-shell/section-header";
import { SponsorCard } from "@/components/app-shell/sponsor-card";
import { StatusBadge } from "@/components/app-shell/status-badge";
import { OperationBanner } from "@/components/team-operations/operation-banner";
import type { MemberProfile, SponsorRecord } from "@/lib/app-shell/types";
import { memberOperationRequest } from "@/lib/member-operations";

type MemberProfileClientProps = {
  sponsor: SponsorRecord;
  memberProfile: MemberProfile;
  leadCount: number;
  assignmentCount: number;
};

export function MemberProfileClient({
  sponsor,
  memberProfile,
  leadCount,
  assignmentCount,
}: MemberProfileClientProps) {
  const [currentSponsor, setCurrentSponsor] = useState(sponsor);
  const [formState, setFormState] = useState({
    displayName: sponsor.displayName,
    email: sponsor.email ?? "",
    phone: sponsor.phone ?? "",
    availabilityStatus: sponsor.availabilityStatus,
  });
  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState<{
    tone: "success" | "error";
    message: string;
  } | null>(null);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSaving(true);
    setFeedback(null);

    try {
      const updatedSponsor = await memberOperationRequest<SponsorRecord>(
        "/sponsors/me",
        {
          method: "PATCH",
          body: JSON.stringify({
            displayName: formState.displayName,
            email: formState.email || null,
            phone: formState.phone || null,
            availabilityStatus: formState.availabilityStatus,
          }),
        },
      );

      setCurrentSponsor(updatedSponsor);
      setFormState({
        displayName: updatedSponsor.displayName,
        email: updatedSponsor.email ?? "",
        phone: updatedSponsor.phone ?? "",
        availabilityStatus: updatedSponsor.availabilityStatus,
      });
      setFeedback({
        tone: "success",
        message: "Perfil operativo actualizado correctamente.",
      });
    } catch (error) {
      setFeedback({
        tone: "error",
        message:
          error instanceof Error
            ? error.message
            : "No pudimos guardar tu perfil.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-8">
      <SectionHeader
        eyebrow="Sponsor / Member / Perfil"
        title="Perfil operativo del member"
        description="Aquí el sponsor mantiene sus datos visibles para handoff y controla si quiere seguir recibiendo leads nuevos."
      />

      {feedback ? (
        <OperationBanner tone={feedback.tone} message={feedback.message} />
      ) : null}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Disponibilidad"
          value={currentSponsor.availabilityStatus}
          hint="Estado operativo que impacta el routing del round robin."
        />
        <KpiCard
          label="Routing weight"
          value={String(currentSponsor.routingWeight)}
          hint="Peso actual visible para la distribución del pool."
        />
        <KpiCard
          label="Leads activos"
          value={String(leadCount)}
          hint="Oportunidades hoy asociadas a este sponsor."
        />
        <KpiCard
          label="Assignments"
          value={String(assignmentCount)}
          hint="Carga operativa total ligada al member."
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.85fr_1.15fr]">
        <SponsorCard
          sponsor={currentSponsor}
          leadCount={leadCount}
          assignmentCount={assignmentCount}
          actions={
            <div className="flex flex-wrap gap-2">
              <StatusBadge value={currentSponsor.status} />
              <StatusBadge value={currentSponsor.availabilityStatus} />
            </div>
          }
        />

        <form
          onSubmit={handleSubmit}
          className="space-y-5 rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_18px_45px_rgba(15,23,42,0.05)]"
        >
          <div>
            <h2 className="text-xl font-semibold text-slate-950">
              Datos visibles del sponsor
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Esta información quedará disponible para reveal y handoff en fases
              siguientes, así que aquí cuidamos el perfil operativo básico.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-2 text-sm">
              <span className="font-medium text-slate-700">Nombre visible</span>
              <input
                value={formState.displayName}
                onChange={(event) =>
                  setFormState((current) => ({
                    ...current,
                    displayName: event.target.value,
                  }))
                }
                className="w-full rounded-2xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 outline-none transition focus:border-slate-400"
              />
            </label>

            <label className="space-y-2 text-sm">
              <span className="font-medium text-slate-700">Disponibilidad</span>
              <select
                value={formState.availabilityStatus}
                onChange={(event) =>
                  setFormState((current) => ({
                    ...current,
                    availabilityStatus: event.target.value,
                  }))
                }
                className="w-full rounded-2xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 outline-none transition focus:border-slate-400"
              >
                <option value="available">available</option>
                <option value="paused">paused</option>
                <option value="offline">offline</option>
              </select>
            </label>

            <label className="space-y-2 text-sm">
              <span className="font-medium text-slate-700">Email visible</span>
              <input
                value={formState.email}
                onChange={(event) =>
                  setFormState((current) => ({
                    ...current,
                    email: event.target.value,
                  }))
                }
                className="w-full rounded-2xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 outline-none transition focus:border-slate-400"
              />
            </label>

            <label className="space-y-2 text-sm">
              <span className="font-medium text-slate-700">Teléfono visible</span>
              <input
                value={formState.phone}
                onChange={(event) =>
                  setFormState((current) => ({
                    ...current,
                    phone: event.target.value,
                  }))
                }
                className="w-full rounded-2xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 outline-none transition focus:border-slate-400"
              />
            </label>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={isSaving}
              className="rounded-full bg-slate-950 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Guardar perfil operativo
            </button>
          </div>
        </form>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_18px_45px_rgba(15,23,42,0.05)]">
        <h2 className="text-xl font-semibold text-slate-950">
          Preferencias aún temporales
        </h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Estas preferencias siguen separadas del dominio productivo y quedarán
          para una fase posterior de configuración personal más profunda.
        </p>

        <dl className="mt-6 grid gap-5 text-sm md:grid-cols-2">
          <div>
            <dt className="text-slate-500">Título</dt>
            <dd className="mt-1 font-medium text-slate-900">{memberProfile.title}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Foco comercial</dt>
            <dd className="mt-1 font-medium text-slate-900">{memberProfile.focus}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Timezone</dt>
            <dd className="mt-1 font-medium text-slate-900">
              {memberProfile.timezone}
            </dd>
          </div>
          <div>
            <dt className="text-slate-500">Ventana de respuesta</dt>
            <dd className="mt-1 font-medium text-slate-900">
              {memberProfile.responseWindow}
            </dd>
          </div>
          <div className="md:col-span-2">
            <dt className="text-slate-500">Canales preferidos</dt>
            <dd className="mt-2 flex flex-wrap gap-2">
              {memberProfile.channels.map((channel) => (
                <span
                  key={channel}
                  className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-slate-700"
                >
                  {channel}
                </span>
              ))}
            </dd>
          </div>
          <div className="md:col-span-2">
            <dt className="text-slate-500">Notas</dt>
            <dd className="mt-1 leading-6 text-slate-800">{memberProfile.notes}</dd>
          </div>
        </dl>
      </section>
    </div>
  );
}
