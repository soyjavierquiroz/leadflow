"use client";

import Link from "next/link";
import { Activity, Gauge, Sparkles } from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";
import { MemberActiveWheelCard } from "@/components/member-operations/member-active-wheel-card";
import { MemberInlineBanner } from "@/components/member-operations/member-inline-banner";
import { MemberProtectionHubButton } from "@/components/member-operations/member-protection-hub-button";
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

type KreditBalanceValue = string | number;

type SponsorKreditsResponse = {
  balance: KreditBalanceValue;
};

const leadStatusTone: Record<MemberDashboardLeadStatus, string> = {
  captured: "border-app-border bg-app-surface-muted text-app-text-muted",
  qualified: "border-app-accent bg-app-accent-soft text-app-accent",
  assigned: "border-app-warning-border bg-app-warning-bg text-app-warning-text",
  nurturing:
    "border-orange-400/25 bg-orange-400/10 text-orange-600 dark:text-orange-300",
  won: "border-app-success-border bg-app-success-bg text-app-success-text",
  lost: "border-app-border bg-app-surface-muted text-app-text-soft",
};

const assignmentStatusTone: Record<MemberDashboardAssignmentStatus, string> = {
  assigned: "border-app-warning-border bg-app-warning-bg text-app-warning-text",
  accepted: "border-app-success-border bg-app-success-bg text-app-success-text",
};

const reminderTone = {
  overdue: "border-app-danger-border bg-app-danger-bg text-app-danger-text",
  due_today:
    "border-app-warning-border bg-app-warning-bg text-app-warning-text",
  upcoming: "border-app-accent bg-app-accent-soft text-app-accent",
  unscheduled: "border-app-border bg-app-surface-muted text-app-text-muted",
  none: "border-app-border bg-app-surface-muted text-app-text-soft",
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

const walletEngineNotConfiguredText = "Wallet engine client is not configured";

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

const formatKreditsBalance = (value: KreditBalanceValue) => {
  const balance = Number(value);

  if (Number.isFinite(balance)) {
    return balance.toFixed(6);
  }

  return typeof value === "string" ? value : String(value);
};

const getKreditsLoadErrorMessage = (error: unknown) => {
  if (
    error instanceof Error &&
    error.message.includes(walletEngineNotConfiguredText)
  ) {
    return "No pudimos cargar tu saldo de KREDITs.";
  }

  return error instanceof Error
    ? error.message
    : "No pudimos cargar tu saldo de KREDITs.";
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
      className={`rounded-[1.1rem] border p-4 ${
        emphasize
          ? "border-app-warning-border bg-app-warning-bg"
          : "border-app-border bg-app-surface-muted"
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border ${
              emphasize
                ? "border-app-warning-border bg-app-surface-strong text-app-warning-text"
                : "border-app-border bg-app-surface-strong text-app-text-muted"
            }`}
          >
            {icon}
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-app-text-soft">
              {label}
            </p>
            <p className="mt-1 text-xs leading-5 text-app-text-muted">{hint}</p>
          </div>
        </div>
        <p
          className={`shrink-0 text-2xl font-semibold tracking-tight ${
            emphasize ? "text-app-warning-text" : "text-app-text"
          }`}
        >
          {formatCompactNumber(value)}
        </p>
      </div>
    </article>
  );
}

function MetaChip({ label }: { label: string }) {
  return (
    <span className="rounded-full border border-app-border bg-app-surface-muted px-3 py-1 text-xs font-medium text-app-text-muted">
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
  const [kreditsBalance, setKreditsBalance] = useState<KreditBalanceValue | null>(
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

        setKreditsError(getKreditsLoadErrorMessage(error));
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
    <div className="w-full space-y-4 text-app-text">
      {feedback ? (
        <MemberInlineBanner tone={feedback.tone} message={feedback.message} />
      ) : null}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <section className="overflow-hidden rounded-[1.75rem] border border-app-border bg-[radial-gradient(circle_at_top_left,var(--app-accent-soft),transparent_38%),linear-gradient(180deg,var(--app-surface)_0%,var(--app-surface-strong)_100%)] p-5 shadow-[0_22px_60px_rgba(2,6,23,0.1)] lg:col-span-8">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <p className="text-[11px] font-semibold uppercase tracking-[0.26em] text-app-accent">
                Dashboard / Asesor
              </p>
              <h1 className="mt-2 text-2xl font-semibold tracking-tight text-app-text md:text-3xl">
                Conecta tu canal, revisa tu bandeja y mueve el siguiente paso.
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-app-text-muted">
                Aquí ves lo esencial de tu jornada: estado de WhatsApp, handoffs
                nuevos, seguimientos urgentes y cartera activa.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <MetaChip label={sponsor.displayName} />
              <MetaChip
                label={`${inbox.length} lead${inbox.length === 1 ? "" : "s"} en foco`}
              />
              <MetaChip
                label={
                  isReceivingLeads ? "Recibiendo leads" : "Recepción pausada"
                }
              />
            </div>
          </div>
        </section>

        <div className="lg:col-span-4">
          <MemberProtectionHubButton
            advisorPhone={sponsor.phone ?? null}
            isSsoAvailable
          />
        </div>

        <div className="lg:col-span-7">
          <WhatsAppConnectionManager
            instanceName={instanceName}
            title="Tu canal de WhatsApp"
            description="Si está activo, sigues operando desde aquí. Si no, conecta el teléfono con un solo código."
            compactWhenConnected
          />
        </div>

        <aside className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:col-span-5 lg:grid-cols-1">
          <section className="rounded-[1.5rem] border border-app-border bg-[linear-gradient(180deg,var(--app-surface)_0%,var(--app-surface-strong)_100%)] p-4 shadow-[0_18px_45px_rgba(2,6,23,0.08)]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-app-text-soft">
                  Estado
                </p>
                <h2 className="mt-1 text-base font-semibold text-app-text">
                  {availability.title}
                </h2>
                <p className="mt-1 text-sm leading-6 text-app-text-muted">
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
                className={`relative inline-flex h-8 w-14 items-center rounded-full border transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-app-accent-soft disabled:cursor-not-allowed disabled:opacity-60 ${
                  isReceivingLeads
                    ? "border-app-success-border bg-app-success-text"
                    : "border-app-border-strong bg-app-text-soft"
                }`}
              >
                <span
                  className={`inline-block h-6 w-6 rounded-full bg-white shadow transition ${
                    isReceivingLeads ? "translate-x-7" : "translate-x-1"
                  }`}
                />
              </button>
            </div>

            <div className="mt-4 flex items-center justify-between gap-3 rounded-[1rem] border border-app-border bg-app-surface-muted p-4">
              <div>
                <p className="text-sm font-semibold text-app-text">
                  Tu recepción hoy
                </p>
                <p className="mt-1 text-sm text-app-text-muted">
                  {isReceivingLeads
                    ? "Lista para recibir nuevos handoffs."
                    : "Cuidando la carga actual antes de abrir más."}
                </p>
              </div>
              <SoftBadge
                label={isReceivingLeads ? "Activa" : "Pausada"}
                tone={
                  isReceivingLeads
                    ? "border-app-success-border bg-app-success-bg text-app-success-text"
                    : "border-app-border bg-app-surface-strong text-app-text-muted"
                }
              />
            </div>
          </section>

          <section className="rounded-[1.5rem] border border-app-border bg-[linear-gradient(180deg,var(--app-surface)_0%,var(--app-surface-strong)_100%)] p-4 shadow-[0_18px_45px_rgba(2,6,23,0.08)]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-app-text-soft">
                  IA Wallet
                </p>
                <p className="mt-1 text-sm font-medium text-app-text">
                  Saldo para automatizaciones
                </p>
              </div>
              <div className="rounded-full border border-app-border bg-app-surface-muted px-3 py-1.5 text-xs font-semibold text-app-text">
                {loadingKredits
                  ? "Cargando..."
                  : kreditsBalance !== null
                    ? `${formatKreditsBalance(kreditsBalance)} KREDITs`
                    : "Saldo no disponible"}
              </div>
            </div>

            {kreditsError ? (
              <p className="mt-3 text-sm font-medium text-app-danger-text">
                {kreditsError}
              </p>
            ) : (
              <p className="mt-3 text-sm leading-6 text-app-text-muted">
                Lectura rápida del saldo disponible para tus flujos y
                automatizaciones.
              </p>
            )}
          </section>
        </aside>

        <section className="overflow-hidden rounded-[1.75rem] border border-app-border bg-[linear-gradient(180deg,var(--app-surface)_0%,var(--app-surface-strong)_100%)] shadow-[0_20px_55px_rgba(2,6,23,0.08)] lg:col-span-8">
          <div className="flex flex-col gap-3 border-b border-app-border px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-app-text-soft">
                Bandeja de hoy
              </p>
              <h2 className="mt-1 text-lg font-semibold tracking-tight text-app-text">
                Leads visibles para actuar sin cambiar de pantalla
              </h2>
              <p className="mt-1 text-sm text-app-text-muted">
                Revisa quién necesita respuesta, acepta nuevos handoffs y abre
                tu cartera cuando haga falta.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <MetaChip label={`${kpis.handoffsNew} nuevos`} />
              <MetaChip label={`${kpis.actionsToday} urgentes`} />
              <MetaChip label={`${kpis.activePortfolio} activos`} />
            </div>
          </div>

          {inbox.length === 0 ? (
            <div className="p-5">
              <div className="rounded-[1.25rem] border border-app-border bg-app-surface-muted p-5 text-center">
                <h3 className="text-lg font-semibold text-app-text">
                  Tu bandeja está despejada
                </h3>
                <p className="mt-2 text-sm leading-6 text-app-text-muted">
                  Cuando entre un handoff nuevo o reaparezca un seguimiento
                  urgente, quedará visible aquí sin cambiar de módulo.
                </p>
              </div>
            </div>
          ) : (
            <div className="divide-y divide-app-border lg:max-h-[calc(100vh-20rem)] lg:overflow-auto">
              {inbox.map((lead) => {
                const isNewLead = lead.assignmentStatus === "assigned";
                const isAccepting = loadingAction === `accept:${lead.id}`;

                return (
                  <article
                    key={lead.id}
                    className="p-5 transition hover:bg-app-surface-muted"
                  >
                    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_220px]">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-base font-semibold text-app-text">
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

                        <p className="mt-1 text-sm text-app-text-muted">
                          {lead.companyName?.trim() || lead.contactLabel}
                        </p>

                        <div className="mt-3 flex flex-wrap gap-2 text-xs text-app-text-soft">
                          <span className="rounded-full border border-app-border bg-app-surface-muted px-3 py-1">
                            {buildOriginLabel(lead)}
                          </span>
                          <span className="rounded-full border border-app-border bg-app-surface-muted px-3 py-1">
                            Entró: {formatDateTime(lead.assignedAt)}
                          </span>
                          {lead.followUpAt ? (
                            <span className="rounded-full border border-app-border bg-app-surface-muted px-3 py-1">
                              Seguimiento: {formatDateTime(lead.followUpAt)}
                            </span>
                          ) : null}
                        </div>

                        <div
                          className={`mt-3 rounded-[1rem] border px-4 py-3 ${
                            lead.needsAttention
                              ? "border-app-warning-border bg-app-warning-bg"
                              : "border-app-border bg-app-surface-muted"
                          }`}
                        >
                          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-app-text-soft">
                            Siguiente paso
                          </p>
                          <p className="mt-1 text-sm leading-6 text-app-text">
                            {lead.nextActionLabel}
                          </p>
                        </div>
                      </div>

                      <div className="flex min-w-[220px] flex-col items-start justify-between gap-3 xl:items-end">
                        <p className="text-sm text-app-text-muted xl:text-right">
                          {isNewLead
                            ? "Confírmalo para que pase a tu cartera activa."
                            : "Ya forma parte de tu cartera y puedes seguirlo."}
                        </p>

                        {isNewLead ? (
                          <button
                            type="button"
                            onClick={() => handleAcceptLead(lead)}
                            disabled={isAccepting}
                            className="rounded-full bg-app-text px-4 py-2 text-sm font-semibold text-app-bg transition hover:opacity-92 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-app-accent-soft disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {isAccepting ? "Aceptando..." : "Aceptar lead"}
                          </button>
                        ) : (
                          <Link
                            href="/member/leads"
                            className="rounded-full border border-app-border bg-app-surface-muted px-4 py-2 text-sm font-semibold text-app-text transition hover:border-app-border-strong hover:bg-app-surface-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-app-accent-soft"
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

        <aside className="min-w-0 space-y-4 lg:col-span-4">
          <section className="rounded-[1.5rem] border border-app-border bg-[linear-gradient(180deg,var(--app-surface)_0%,var(--app-surface-strong)_100%)] p-4 shadow-[0_18px_45px_rgba(2,6,23,0.08)]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-app-text-soft">
                  Resumen rápido
                </p>
                <p className="mt-1 text-sm text-app-text-muted">
                  Lectura corta para priorizar tu jornada.
                </p>
              </div>
              <span className="rounded-full border border-app-border bg-app-surface-muted px-3 py-1 text-xs font-medium text-app-text-soft">
                Vista diaria
              </span>
            </div>

            <div className="mt-4 space-y-4">
              <MetricMiniCard
                label="Atención inmediata"
                value={kpis.handoffsNew}
                hint="Leads nuevos pendientes de aceptación."
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
                hint="Leads ya aceptados bajo tu gestión."
                icon={<Gauge className="h-4 w-4" />}
              />
            </div>
          </section>

          <MemberActiveWheelCard />
        </aside>
      </div>
    </div>
  );
}
