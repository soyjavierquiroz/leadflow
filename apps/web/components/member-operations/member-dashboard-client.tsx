"use client";

import Link from "next/link";
import { Activity, Gauge, Sparkles } from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";
import { MemberActiveWheelCard } from "@/components/member-operations/member-active-wheel-card";
import { MemberInlineBanner } from "@/components/member-operations/member-inline-banner";
import { WhatsAppConnectionManager } from "@/components/member-operations/whatsapp-connection-manager";
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
  instanceName: string;
};

type SponsorKreditsResponse = {
  balance: string | number;
};

const leadStatusTone: Record<MemberDashboardLeadStatus, string> = {
  captured: "border-slate-700 bg-slate-900/80 text-slate-200",
  qualified: "border-sky-500/20 bg-sky-500/10 text-sky-100",
  assigned: "border-amber-500/20 bg-amber-500/10 text-amber-100",
  nurturing: "border-orange-500/20 bg-orange-500/10 text-orange-100",
  won: "border-emerald-500/20 bg-emerald-500/10 text-emerald-100",
  lost: "border-slate-700 bg-slate-900/70 text-slate-400",
};

const assignmentStatusTone: Record<MemberDashboardAssignmentStatus, string> = {
  assigned: "border-amber-500/20 bg-amber-500/10 text-amber-100",
  accepted: "border-emerald-500/20 bg-emerald-500/10 text-emerald-100",
};

const reminderTone = {
  overdue: "border-rose-500/20 bg-rose-500/10 text-rose-100",
  due_today: "border-amber-500/20 bg-amber-500/10 text-amber-100",
  upcoming: "border-sky-500/20 bg-sky-500/10 text-sky-100",
  unscheduled: "border-slate-700 bg-slate-900/80 text-slate-200",
  none: "border-slate-700 bg-slate-900/60 text-slate-300",
} as const;

const availabilityCopy = {
  available: {
    title: "Recibiendo leads nuevos",
    description:
      "Tu bandeja sigue abierta y puede absorber handoffs nuevos hoy.",
  },
  paused: {
    title: "Entrada de leads pausada",
    description:
      "Tu bandeja sigue operativa, pero no entrarán handoffs nuevos hasta reactivarla.",
  },
  offline: {
    title: "Recepción detenida",
    description: "Tu sponsor quedó fuera de asignación temporalmente.",
  },
} as const;

const toSentenceCase = (value: string) =>
  value.replace(/[_-]+/g, " ").replace(/^./, (letter) => letter.toUpperCase());

const kreditBalanceFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 2,
});

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

const formatKreditsBalance = (value: string | number) => {
  const numericValue = typeof value === "number" ? value : Number(value);

  if (Number.isFinite(numericValue)) {
    return kreditBalanceFormatter.format(numericValue);
  }

  return typeof value === "string" ? value : String(value);
};

function SoftBadge({ label, tone }: { label: string; tone: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold ${tone}`}
    >
      {label}
    </span>
  );
}

function MetricMiniCard({
  label,
  value,
  hint,
  icon,
  emphasize = false,
}: {
  label: string;
  value: number;
  hint: string;
  icon: ReactNode;
  emphasize?: boolean;
}) {
  return (
    <article
      className={`rounded-[1.25rem] border p-4 ${
        emphasize
          ? "border-amber-500/20 bg-amber-500/10"
          : "border-slate-800 bg-slate-950/70"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">
            {label}
          </p>
          <p
            className={`mt-2 text-3xl font-semibold tracking-tight ${
              emphasize ? "text-amber-100" : "text-slate-50"
            }`}
          >
            {formatCompactNumber(value)}
          </p>
        </div>
        <div
          className={`flex h-10 w-10 items-center justify-center rounded-2xl border ${
            emphasize
              ? "border-amber-500/25 bg-amber-500/10 text-amber-100"
              : "border-slate-700 bg-slate-900 text-slate-300"
          }`}
        >
          {icon}
        </div>
      </div>
      <p className="mt-2 text-sm leading-5 text-slate-400">{hint}</p>
    </article>
  );
}

function MetaChip({ label }: { label: string }) {
  return (
    <span className="rounded-full border border-slate-800 bg-slate-950/70 px-3 py-1 text-xs font-medium text-slate-300">
      {label}
    </span>
  );
}

export function MemberDashboardClient({
  initialDashboard,
  instanceName,
}: MemberDashboardClientProps) {
  const [sponsor, setSponsor] = useState(initialDashboard.sponsor);
  const [inbox, setInbox] = useState(initialDashboard.inbox);
  const [kreditsBalance, setKreditsBalance] = useState<string | number | null>(
    null,
  );
  const [kreditsError, setKreditsError] = useState<string | null>(null);
  const [loadingKredits, setLoadingKredits] = useState(true);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{
    tone: "success" | "error";
    message: string;
  } | null>(null);

  const kpis = buildKpis(inbox);
  const availability =
    availabilityCopy[sponsor.availabilityStatus] ?? availabilityCopy.paused;
  const isReceivingLeads = sponsor.availabilityStatus === "available";

  useEffect(() => {
    let isMounted = true;

    const loadKreditsBalance = async () => {
      try {
        const response = await memberOperationRequest<SponsorKreditsResponse>(
          "/sponsors/me/kredits",
          {
            method: "GET",
          },
        );

        if (!isMounted) {
          return;
        }

        setKreditsBalance(response.balance);
        setKreditsError(null);
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setKreditsError(
          error instanceof Error
            ? error.message
            : "No pudimos cargar tu saldo de KREDITs.",
        );
      } finally {
        if (isMounted) {
          setLoadingKredits(false);
        }
      }
    };

    void loadKreditsBalance();

    return () => {
      isMounted = false;
    };
  }, []);

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
    <div className="space-y-4 text-slate-100">
      <section className="overflow-hidden rounded-[1.75rem] border border-slate-800 bg-[radial-gradient(circle_at_top_left,_rgba(14,165,233,0.10),_transparent_28%),linear-gradient(180deg,_rgba(15,23,42,0.98)_0%,_rgba(2,6,23,0.98)_100%)] p-4 shadow-[0_22px_60px_rgba(2,6,23,0.4)]">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl">
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-cyan-300">
              Sponsor / Member / Centro de mando
            </p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight text-white md:text-3xl">
              WhatsApp arriba, operación abajo
            </h1>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              El dashboard prioriza la conexión del asesor y deja la bandeja
              operativa visible en el mismo viewport para trabajar sin rodeos.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <MetaChip label={sponsor.displayName} />
            <MetaChip label={`${inbox.length} lead${inbox.length === 1 ? "" : "s"} en foco`} />
            <MetaChip
              label={
                isReceivingLeads ? "Capacidad abierta" : "Capacidad pausada"
              }
            />
          </div>
        </div>
      </section>

      {feedback ? (
        <MemberInlineBanner tone={feedback.tone} message={feedback.message} />
      ) : null}

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.7fr)_minmax(300px,0.8fr)]">
        <div className="min-w-0 space-y-4">
          <WhatsAppConnectionManager
            instanceName={instanceName}
            title="WhatsApp del asesor"
            description="Si la sesión está viva, se ve como un banner corto. Si no está conectada, el QR queda primero y sin scroll."
          />

          <section className="overflow-hidden rounded-[1.75rem] border border-slate-800 bg-[linear-gradient(180deg,_rgba(15,23,42,0.96)_0%,_rgba(2,6,23,0.98)_100%)] shadow-[0_20px_55px_rgba(2,6,23,0.32)]">
            <div className="flex flex-col gap-3 border-b border-slate-800 px-4 py-4 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.26em] text-slate-400">
                  Bandeja Operativa
                </p>
                <h2 className="mt-1 text-xl font-semibold tracking-tight text-white">
                  Lo que conviene mover ahora
                </h2>
                <p className="mt-1 text-sm leading-6 text-slate-400">
                  Leads nuevos y seguimientos urgentes con el siguiente paso al
                  frente, sin adornos que quiten espacio.
                </p>
              </div>

              <div className="rounded-full border border-slate-800 bg-slate-950/80 px-3 py-1.5 text-xs font-medium text-slate-300">
                {inbox.length} lead{inbox.length === 1 ? "" : "s"} en foco
              </div>
            </div>

            {inbox.length === 0 ? (
              <div className="px-4 py-10 text-center">
                <h3 className="text-xl font-semibold text-white">
                  Bandeja vacía
                </h3>
                <p className="mx-auto mt-2 max-w-2xl text-sm leading-6 text-slate-400">
                  Cuando entre un handoff nuevo o reaparezca un seguimiento
                  urgente, se verá aquí con prioridad clara.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-800">
                {inbox.map((lead) => {
                  const isNewLead = lead.assignmentStatus === "assigned";
                  const isAccepting = loadingAction === `accept:${lead.id}`;

                  return (
                    <article
                      key={lead.id}
                      className="px-4 py-4 transition hover:bg-slate-900/45"
                    >
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-base font-semibold text-white">
                              {lead.leadName}
                            </h3>
                            <SoftBadge
                              label={toSentenceCase(lead.assignmentStatus)}
                              tone={
                                assignmentStatusTone[lead.assignmentStatus]
                              }
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

                          <p className="mt-1 text-sm text-slate-300">
                            {lead.companyName?.trim() || lead.contactLabel}
                          </p>

                          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-400">
                            <span className="rounded-full border border-slate-800 bg-slate-950/70 px-3 py-1">
                              {buildOriginLabel(lead)}
                            </span>
                            <span className="rounded-full border border-slate-800 bg-slate-950/70 px-3 py-1">
                              Entró: {formatDateTime(lead.assignedAt)}
                            </span>
                            {lead.followUpAt ? (
                              <span className="rounded-full border border-slate-800 bg-slate-950/70 px-3 py-1">
                                Seguimiento: {formatDateTime(lead.followUpAt)}
                              </span>
                            ) : null}
                          </div>

                          <div
                            className={`mt-3 rounded-[1.1rem] border px-4 py-3 ${
                              lead.needsAttention
                                ? "border-amber-500/20 bg-amber-500/10"
                                : "border-slate-800 bg-slate-950/70"
                            }`}
                          >
                            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                              Siguiente paso
                            </p>
                            <p className="mt-1 text-sm leading-6 text-slate-200">
                              {lead.nextActionLabel}
                            </p>
                          </div>
                        </div>

                        <div className="flex min-w-[190px] flex-col items-start gap-3 lg:items-end">
                          <p className="text-sm text-slate-400 lg:text-right">
                            {isNewLead
                              ? "Todavía espera tu confirmación."
                              : "Ya forma parte de tu cartera activa."}
                          </p>

                          {isNewLead ? (
                            <button
                              type="button"
                              onClick={() => handleAcceptLead(lead)}
                              disabled={isAccepting}
                              className="rounded-full bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              {isAccepting ? "Aceptando..." : "Aceptar Lead"}
                            </button>
                          ) : (
                            <Link
                              href="/member/leads"
                              className="rounded-full border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-semibold text-slate-100 transition hover:bg-slate-800"
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

        <aside className="min-w-0 space-y-4">
          <section className="rounded-[1.6rem] border border-slate-800 bg-[linear-gradient(180deg,_rgba(15,23,42,0.98)_0%,_rgba(2,6,23,0.96)_100%)] p-4 shadow-[0_18px_45px_rgba(2,6,23,0.28)]">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">
                  Mi jornada comercial
                </p>
                <p className="mt-1 text-sm text-slate-400">
                  Lectura rápida de lo que exige atención hoy.
                </p>
              </div>
              <div className="rounded-full border border-slate-800 bg-slate-950 px-3 py-1 text-xs font-medium text-slate-300">
                Vista compacta
              </div>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
              <MetricMiniCard
                label="Atención inmediata"
                value={kpis.handoffsNew}
                hint="Handoffs nuevos pendientes de aceptación."
                icon={<Sparkles className="h-4 w-4" />}
                emphasize={kpis.handoffsNew > 0}
              />
              <MetricMiniCard
                label="Acciones para hoy"
                value={kpis.actionsToday}
                hint="Seguimientos urgentes o vencidos."
                icon={<Activity className="h-4 w-4" />}
              />
              <MetricMiniCard
                label="Cartera activa"
                value={kpis.activePortfolio}
                hint="Leads que siguen bajo tu gestión."
                icon={<Gauge className="h-4 w-4" />}
              />
            </div>
          </section>

          <section className="rounded-[1.6rem] border border-slate-800 bg-[linear-gradient(180deg,_rgba(15,23,42,0.98)_0%,_rgba(2,6,23,0.96)_100%)] p-4 shadow-[0_18px_45px_rgba(2,6,23,0.28)]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">
                  Capacidad
                </p>
                <h2 className="mt-1 text-lg font-semibold text-white">
                  {availability.title}
                </h2>
                <p className="mt-1 text-sm leading-6 text-slate-400">
                  {availability.description}
                </p>
              </div>

              <button
                type="button"
                role="switch"
                aria-checked={isReceivingLeads}
                aria-label="Recibir leads nuevos"
                disabled={loadingAction === "availability"}
                onClick={() => handleAvailabilityChange(!isReceivingLeads)}
                className={`relative inline-flex h-8 w-14 items-center rounded-full transition disabled:cursor-not-allowed disabled:opacity-60 ${
                  isReceivingLeads ? "bg-emerald-500" : "bg-slate-700"
                }`}
              >
                <span
                  className={`inline-block h-6 w-6 rounded-full bg-white shadow transition ${
                    isReceivingLeads ? "translate-x-7" : "translate-x-1"
                  }`}
                />
              </button>
            </div>

            <div className="mt-4 rounded-[1.2rem] border border-slate-800 bg-slate-950/80 p-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-white">
                    Estado del asesor
                  </p>
                  <p className="mt-1 text-sm text-slate-400">
                    {isReceivingLeads
                      ? "Disponible para nuevos handoffs."
                      : "Protegiendo la carga actual."}
                  </p>
                </div>
                <SoftBadge
                  label={isReceivingLeads ? "Activo" : "Pausado"}
                  tone={
                    isReceivingLeads
                      ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-100"
                      : "border-slate-700 bg-slate-900 text-slate-300"
                  }
                />
              </div>
            </div>

            <div className="mt-3 rounded-[1.2rem] border border-cyan-500/20 bg-cyan-500/10 p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-cyan-200">
                    IA Wallet
                  </p>
                  <p className="mt-1 text-sm font-medium text-white">
                    Saldo operativo para automatizaciones y n8n
                  </p>
                </div>
                <div className="rounded-full border border-cyan-500/20 bg-slate-950/80 px-3 py-1.5 text-xs font-semibold text-cyan-100">
                  {loadingKredits
                    ? "Cargando..."
                    : kreditsBalance !== null
                      ? `${formatKreditsBalance(kreditsBalance)} KREDITs`
                      : "Saldo no disponible"}
                </div>
              </div>

              {kreditsError ? (
                <p className="mt-2 text-xs font-medium text-rose-200">
                  {kreditsError}
                </p>
              ) : (
                <p className="mt-2 text-sm leading-6 text-cyan-50/80">
                  Wallet compacta para supervisar el combustible de tus flujos
                  sin sacarte de la operación.
                </p>
              )}
            </div>
          </section>

          <MemberActiveWheelCard />
        </aside>
      </section>
    </div>
  );
}
