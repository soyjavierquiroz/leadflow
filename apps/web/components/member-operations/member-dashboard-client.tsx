"use client";

import Link from "next/link";
import { useState } from "react";
import { SectionHeader } from "@/components/app-shell/section-header";
import { MemberActiveWheelCard } from "@/components/member-operations/member-active-wheel-card";
import { OperationBanner } from "@/components/team-operations/operation-banner";
import {
  type MemberDashboardAssignmentStatus,
  type MemberDashboardLead,
  type MemberDashboardLeadStatus,
  type MemberDashboardSnapshot,
  type MemberDashboardSponsor,
} from "@/lib/member-dashboard";
import { formatCompactNumber, formatDateTime } from "@/lib/app-shell/utils";
import { memberOperationRequest } from "@/lib/member-operations";

type MemberDashboardClientProps = {
  initialDashboard: MemberDashboardSnapshot;
};

const leadStatusTone: Record<MemberDashboardLeadStatus, string> = {
  captured: "border-slate-200 bg-slate-100 text-slate-700",
  qualified: "border-sky-200 bg-sky-50 text-sky-700",
  assigned: "border-amber-200 bg-amber-50 text-amber-700",
  nurturing: "border-orange-200 bg-orange-50 text-orange-700",
  won: "border-emerald-200 bg-emerald-50 text-emerald-700",
  lost: "border-slate-200 bg-slate-100 text-slate-600",
};

const assignmentStatusTone: Record<MemberDashboardAssignmentStatus, string> = {
  assigned: "border-amber-200 bg-amber-50 text-amber-700",
  accepted: "border-emerald-200 bg-emerald-50 text-emerald-700",
};

const reminderTone = {
  overdue: "border-rose-200 bg-rose-50 text-rose-700",
  due_today: "border-amber-200 bg-amber-50 text-amber-700",
  upcoming: "border-sky-200 bg-sky-50 text-sky-700",
  unscheduled: "border-slate-200 bg-slate-100 text-slate-700",
  none: "border-slate-200 bg-white text-slate-600",
} as const;

const availabilityCopy = {
  available: {
    title: "Recibiendo leads nuevos",
    description:
      "Tu capacidad está abierta. Los handoffs nuevos seguirán entrando a tu bandeja.",
  },
  paused: {
    title: "Nuevos leads pausados",
    description:
      "Tu bandeja sigue operativa, pero dejamos de asignarte leads nuevos hasta que reactives la disponibilidad.",
  },
  offline: {
    title: "Recepción temporalmente detenida",
    description: "No estás disponible para nuevos handoffs en este momento.",
  },
} as const;

const toSentenceCase = (value: string) =>
  value.replace(/[_-]+/g, " ").replace(/^./, (letter) => letter.toUpperCase());

const buildKpis = (inbox: MemberDashboardLead[]) => ({
  handoffsNew: inbox.filter((item) => item.assignmentStatus === "assigned")
    .length,
  actionsToday: inbox.filter(
    (item) =>
      item.reminderBucket === "overdue" || item.reminderBucket === "due_today",
  ).length,
  activePortfolio: inbox.filter((item) => item.assignmentStatus === "accepted")
    .length,
});

const buildOriginLabel = (lead: MemberDashboardLead) => {
  const publicationPath = lead.publicationPath?.trim();
  const domainHost = lead.domainHost?.trim();

  if (domainHost && publicationPath) {
    return `${domainHost}${publicationPath}`;
  }

  if (domainHost) {
    return domainHost;
  }

  if (publicationPath) {
    return publicationPath;
  }

  if (lead.funnelName?.trim()) {
    return lead.funnelName.trim();
  }

  return "Origen pendiente";
};

function MetricCard({
  label,
  value,
  hint,
  emphasize = false,
}: {
  label: string;
  value: number;
  hint: string;
  emphasize?: boolean;
}) {
  return (
    <article
      className={`rounded-[1.9rem] border p-5 shadow-[0_20px_55px_rgba(15,23,42,0.06)] transition ${
        emphasize
          ? "border-amber-200 bg-[linear-gradient(180deg,_#fff8eb_0%,_#ffffff_100%)]"
          : "border-slate-200 bg-[linear-gradient(180deg,_#ffffff_0%,_#f8fafc_100%)]"
      }`}
    >
      <p className="text-xs font-semibold uppercase tracking-[0.26em] text-slate-500">
        {label}
      </p>
      <div className="mt-4 flex items-end justify-between gap-4">
        <p
          className={`text-4xl font-semibold tracking-tight ${
            emphasize ? "text-amber-700" : "text-slate-950"
          }`}
        >
          {formatCompactNumber(value)}
        </p>
        {emphasize && value > 0 ? (
          <span className="rounded-full border border-amber-200 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-700">
            Prioridad
          </span>
        ) : null}
      </div>
      <p className="mt-3 text-sm leading-6 text-slate-600">{hint}</p>
    </article>
  );
}

function SoftBadge({ label, tone }: { label: string; tone: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${tone}`}
    >
      {label}
    </span>
  );
}

export function MemberDashboardClient({
  initialDashboard,
}: MemberDashboardClientProps) {
  const [sponsor, setSponsor] = useState(initialDashboard.sponsor);
  const [inbox, setInbox] = useState(initialDashboard.inbox);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{
    tone: "success" | "error";
    message: string;
  } | null>(null);

  const kpis = buildKpis(inbox);
  const availability =
    availabilityCopy[sponsor.availabilityStatus] ?? availabilityCopy.paused;
  const isReceivingLeads = sponsor.availabilityStatus === "available";

  const handleAvailabilityChange = async (nextChecked: boolean) => {
    const availabilityStatus = nextChecked ? "available" : "paused";

    setLoadingAction("availability");
    setFeedback(null);

    try {
      const updatedSponsor =
        await memberOperationRequest<MemberDashboardSponsor>("/sponsors/me", {
          method: "PATCH",
          body: JSON.stringify({ availabilityStatus }),
        });

      setSponsor((current) => ({
        ...current,
        ...updatedSponsor,
      }));
      setFeedback({
        tone: "success",
        message: nextChecked
          ? "Tu disponibilidad quedó activa para recibir leads nuevos."
          : "Pausamos la entrada de nuevos leads a tu bandeja.",
      });
    } catch (error) {
      setFeedback({
        tone: "error",
        message:
          error instanceof Error
            ? error.message
            : "No pudimos actualizar tu disponibilidad.",
      });
    } finally {
      setLoadingAction(null);
    }
  };

  const handleAcceptLead = async (lead: MemberDashboardLead) => {
    const previousInbox = inbox;

    setLoadingAction(`accept:${lead.id}`);
    setFeedback(null);
    setInbox((current) =>
      current.map((item) =>
        item.id === lead.id
          ? {
              ...item,
              assignmentStatus: "accepted",
              leadStatus:
                item.leadStatus === "assigned" ? "nurturing" : item.leadStatus,
            }
          : item,
      ),
    );

    try {
      const acceptedLead = await memberOperationRequest<{
        ok: true;
        leadId: string;
        sponsorId: string;
        assignmentId: string;
        assignmentStatus: "accepted";
        leadStatus: MemberDashboardLeadStatus;
        acceptedAt: string;
        alreadyAccepted: boolean;
      }>(`/sponsors/me/leads/${lead.id}/accept`, {
        method: "POST",
      });

      setInbox((current) =>
        current.map((item) =>
          item.id === lead.id
            ? {
                ...item,
                assignmentStatus: acceptedLead.assignmentStatus,
                leadStatus: acceptedLead.leadStatus,
              }
            : item,
        ),
      );
      setFeedback({
        tone: "success",
        message: acceptedLead.alreadyAccepted
          ? "Este lead ya estaba aceptado y sigue dentro de tu cartera activa."
          : "Lead aceptado. Ya quedó dentro de tu cartera activa.",
      });
    } catch (error) {
      setInbox(previousInbox);
      setFeedback({
        tone: "error",
        message:
          error instanceof Error
            ? error.message
            : "No pudimos aceptar el lead.",
      });
    } finally {
      setLoadingAction(null);
    }
  };

  return (
    <div className="space-y-8">
      <SectionHeader
        eyebrow="Sponsor / Member"
        title="Mi jornada comercial"
        description="Tu bandeja queda resumida en lo que sí mueve trabajo hoy: nuevos handoffs, seguimientos urgentes y la cartera activa que ya depende de ti."
      />

      {feedback ? (
        <OperationBanner tone={feedback.tone} message={feedback.message} />
      ) : null}

      <section className="grid gap-5 xl:grid-cols-[1.45fr_0.95fr]">
        <div className="grid gap-4 md:grid-cols-3">
          <MetricCard
            label="Atención Inmediata"
            value={kpis.handoffsNew}
            hint="Leads nuevos que todavía esperan tu aceptación."
            emphasize={kpis.handoffsNew > 0}
          />
          <MetricCard
            label="Acciones Para Hoy"
            value={kpis.actionsToday}
            hint="Seguimientos urgentes o pendientes que conviene mover hoy."
          />
          <MetricCard
            label="Cartera Activa"
            value={kpis.activePortfolio}
            hint="Total de leads que hoy siguen dentro de tu gestión."
          />
        </div>

        <div className="space-y-4">
          <aside className="rounded-[2rem] border border-slate-200 bg-[linear-gradient(180deg,_#ffffff_0%,_#f8fafc_100%)] p-6 shadow-[0_20px_55px_rgba(15,23,42,0.06)]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.26em] text-slate-500">
                  Capacidad
                </p>
                <h2 className="mt-3 text-2xl font-semibold tracking-tight text-slate-950">
                  {availability.title}
                </h2>
              </div>

              <button
                type="button"
                role="switch"
                aria-checked={isReceivingLeads}
                aria-label="Recibir leads nuevos"
                disabled={loadingAction === "availability"}
                onClick={() => handleAvailabilityChange(!isReceivingLeads)}
                className={`relative inline-flex h-8 w-14 items-center rounded-full transition disabled:cursor-not-allowed disabled:opacity-60 ${
                  isReceivingLeads ? "bg-emerald-500" : "bg-slate-300"
                }`}
              >
                <span
                  className={`inline-block h-6 w-6 rounded-full bg-white shadow transition ${
                    isReceivingLeads ? "translate-x-7" : "translate-x-1"
                  }`}
                />
              </button>
            </div>

            <p className="mt-3 text-sm leading-6 text-slate-600">
              {availability.description}
            </p>

            <div className="mt-5 rounded-[1.5rem] border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-950">
                    Estado del asesor
                  </p>
                  <p className="mt-1 text-sm text-slate-600">
                    {isReceivingLeads
                      ? "Tu bandeja sigue abierta para nuevos handoffs."
                      : "Tu carga actual queda protegida sin nuevas entradas."}
                  </p>
                </div>
                <SoftBadge
                  label={isReceivingLeads ? "Activo" : "Pausado"}
                  tone={
                    isReceivingLeads
                      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                      : "border-slate-200 bg-white text-slate-700"
                  }
                />
              </div>
            </div>
          </aside>

          <MemberActiveWheelCard />
        </div>
      </section>

      <section className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-[0_22px_65px_rgba(15,23,42,0.07)]">
        <div className="flex flex-col gap-3 border-b border-slate-200 bg-[linear-gradient(180deg,_#ffffff_0%,_#f8fafc_100%)] px-6 py-5 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.26em] text-slate-500">
              Bandeja Operativa
            </p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
              Lo que conviene mover ahora
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
              La bandeja prioriza handoffs nuevos y seguimientos que necesitan
              una respuesta clara, sin ruido técnico ni métricas repetidas.
            </p>
          </div>

          <div className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600">
            {inbox.length} lead{inbox.length === 1 ? "" : "s"} en foco
          </div>
        </div>

        {inbox.length === 0 ? (
          <div className="px-6 py-14 text-center">
            <h3 className="text-2xl font-semibold text-slate-950">
              Bandeja vacía
            </h3>
            <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-slate-600">
              No tienes leads activos asignados en este momento. Cuando entre un
              nuevo handoff o reaparezca un seguimiento urgente, lo verás aquí
              con prioridad clara.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {inbox.map((lead) => {
              const isNewLead = lead.assignmentStatus === "assigned";
              const isAccepting = loadingAction === `accept:${lead.id}`;

              return (
                <article
                  key={lead.id}
                  className="px-6 py-5 transition hover:bg-slate-50/70"
                >
                  <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-lg font-semibold text-slate-950">
                          {lead.leadName}
                        </h3>
                        <SoftBadge
                          label={toSentenceCase(lead.assignmentStatus)}
                          tone={assignmentStatusTone[lead.assignmentStatus]}
                        />
                        <SoftBadge
                          label={toSentenceCase(lead.leadStatus)}
                          tone={leadStatusTone[lead.leadStatus]}
                        />
                        <SoftBadge
                          label={lead.reminderLabel}
                          tone={reminderTone[lead.reminderBucket]}
                        />
                      </div>

                      <p className="mt-2 text-sm text-slate-700">
                        {lead.companyName?.trim() || lead.contactLabel}
                      </p>

                      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                        <span className="rounded-full bg-slate-100 px-3 py-1">
                          {buildOriginLabel(lead)}
                        </span>
                        <span className="rounded-full bg-slate-100 px-3 py-1">
                          Entró: {formatDateTime(lead.assignedAt)}
                        </span>
                        {lead.followUpAt ? (
                          <span className="rounded-full bg-slate-100 px-3 py-1">
                            Seguimiento: {formatDateTime(lead.followUpAt)}
                          </span>
                        ) : null}
                      </div>

                      <div
                        className={`mt-4 rounded-[1.35rem] border px-4 py-3 ${
                          lead.needsAttention
                            ? "border-amber-200 bg-amber-50/70"
                            : "border-slate-200 bg-slate-50"
                        }`}
                      >
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                          Siguiente paso
                        </p>
                        <p className="mt-2 text-sm leading-6 text-slate-700">
                          {lead.nextActionLabel}
                        </p>
                      </div>
                    </div>

                    <div className="flex min-w-[210px] flex-col items-start gap-3 xl:items-end">
                      <p className="text-sm text-slate-500">
                        {isNewLead
                          ? "Este handoff todavía espera tu confirmación."
                          : "Ya forma parte de tu cartera en seguimiento."}
                      </p>

                      {isNewLead ? (
                        <button
                          type="button"
                          onClick={() => handleAcceptLead(lead)}
                          disabled={isAccepting}
                          className="rounded-full bg-slate-950 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {isAccepting ? "Aceptando..." : "Aceptar Lead"}
                        </button>
                      ) : (
                        <Link
                          href="/member/leads"
                          className="rounded-full border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-900 transition hover:bg-slate-50"
                        >
                          Gestionar
                        </Link>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
