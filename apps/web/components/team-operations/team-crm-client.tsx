"use client";

import {
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { ReactNode } from "react";
import { KpiCard } from "@/components/app-shell/kpi-card";
import { SectionHeader } from "@/components/app-shell/section-header";
import { StatusBadge } from "@/components/app-shell/status-badge";
import { teamOperationRequest } from "@/lib/team-operations";
import type {
  UnifiedCrmInboxResponse,
  UnifiedCrmInboxSource,
  UnifiedCrmLead,
  UnifiedCrmTab,
} from "@/lib/team-crm";
import {
  formatCompactNumber,
  formatDateTime,
  formatRelativeTime,
  toSentenceCase,
} from "@/lib/app-shell/utils";

type TeamCrmClientProps = {
  initialSnapshot: UnifiedCrmInboxResponse;
};

const tabs = [
  {
    value: "all",
    label: "Todos",
    countKey: "todos",
  },
  {
    value: "registered",
    label: "Registrados",
    countKey: "registrados",
  },
  {
    value: "conversational",
    label: "Conversacionales",
    countKey: "conversacionales",
  },
  {
    value: "duplicates",
    label: "Posibles duplicados",
    countKey: "posibles_duplicados",
  },
  {
    value: "unassigned",
    label: "Sin owner",
    countKey: "sin_owner",
  },
] as const satisfies Array<{
  value: UnifiedCrmTab;
  label: string;
  countKey: keyof UnifiedCrmInboxResponse["counts"];
}>;

const sourceOptions = [
  {
    value: "all",
    label: "Todas las fuentes",
  },
  {
    value: "leadflow",
    label: "LeadFlow",
  },
  {
    value: "supabase",
    label: "WhatsApp/Supabase",
  },
] as const satisfies Array<{
  value: UnifiedCrmInboxSource;
  label: string;
}>;

const filterControlClassName =
  "w-full rounded-full border border-app-border bg-app-card px-4 py-2 text-sm text-app-text outline-none transition placeholder:text-app-text-soft focus:border-app-border-strong focus:ring-2 focus:ring-app-accent-soft md:w-auto [&>option]:bg-app-card [&>option]:text-app-text";

const sourceBadgeClassName = {
  leadflow: "border-app-accent bg-app-accent-soft text-app-accent",
  supabase: "border-app-success-border bg-app-success-bg text-app-success-text",
  merged_candidate: "border-app-warning-border bg-app-warning-bg text-app-warning-text",
} satisfies Record<UnifiedCrmLead["source"], string>;

const flagBadgeClassName = {
  duplicate: "border-app-warning-border bg-app-warning-bg text-app-warning-text",
  orphan: "border-app-danger-border bg-app-danger-bg text-app-danger-text",
  stagnant: "border-app-border bg-app-surface-muted text-app-text-muted",
} satisfies Record<string, string>;

const duplicateReasonLabel = {
  same_phone: "mismo telefono",
  same_whatsapp: "mismo WhatsApp",
  phone_matches_whatsapp: "telefono coincide con WhatsApp",
} satisfies Record<string, string>;

const getLeadTitle = (lead: UnifiedCrmLead) =>
  lead.contact.display_name ??
  lead.contact.phone_e164 ??
  lead.contact.whatsapp_id ??
  "Contacto sin nombre";

const getSourceLabel = (source: UnifiedCrmLead["source"]) => {
  if (source === "leadflow") {
    return "LeadFlow";
  }

  if (source === "supabase") {
    return "WhatsApp/Supabase";
  }

  return "Candidato merge";
};

const getStatus = (lead: UnifiedCrmLead) =>
  lead.leadflow?.status ?? lead.supabase?.status ?? null;

const getRecordId = (lead: UnifiedCrmLead) =>
  lead.leadflow?.lead_id ?? lead.supabase?.saas_lead_id ?? lead.id;

const summarizeId = (value: string) =>
  value.length > 14 ? `${value.slice(0, 8)}...${value.slice(-4)}` : value;

const getDuplicateReasonLabel = (reason: string) =>
  duplicateReasonLabel[reason as keyof typeof duplicateReasonLabel] ??
  toSentenceCase(reason);

const formatPercent = (value: number) => `${Math.round(value * 100)}%`;

const buildInboxPath = (input: {
  tab: UnifiedCrmTab;
  q: string;
  source: UnifiedCrmInboxSource;
}) => {
  const params = new URLSearchParams({
    tab: input.tab,
    limit: "50",
  });

  if (input.q.trim()) {
    params.set("q", input.q.trim());
  }

  if (input.source !== "all") {
    params.set("source", input.source);
  }

  return `/team/crm/inbox?${params.toString()}`;
};

function InlineBadge({
  children,
  className,
}: {
  children: ReactNode;
  className: string;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${className}`}
    >
      {children}
    </span>
  );
}

function LeadCard({ lead }: { lead: UnifiedCrmLead }) {
  const status = getStatus(lead);
  const matchedRecords = lead.dedupe.matched_records ?? [];

  return (
    <article className="rounded-[1.5rem] border border-app-border bg-app-card p-5 shadow-[0_18px_48px_rgba(15,23,42,0.06)]">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <InlineBadge className={sourceBadgeClassName[lead.source]}>
              {getSourceLabel(lead.source)}
            </InlineBadge>
            {lead.flags.possible_duplicate ? (
              <InlineBadge className={flagBadgeClassName.duplicate}>
                Duplicado posible
              </InlineBadge>
            ) : null}
            {lead.flags.is_orphaned ? (
              <InlineBadge className={flagBadgeClassName.orphan}>
                Sin owner
              </InlineBadge>
            ) : null}
            {lead.flags.is_stagnant ? (
              <InlineBadge className={flagBadgeClassName.stagnant}>
                Estancado
              </InlineBadge>
            ) : null}
          </div>

          <h2 className="mt-4 break-words text-xl font-semibold tracking-tight text-app-text">
            {getLeadTitle(lead)}
          </h2>

          <div className="mt-3 grid gap-2 text-sm text-app-text-muted sm:grid-cols-2">
            <p>
              <span className="font-semibold text-app-text-soft">Telefono:</span>{" "}
              {lead.contact.phone_e164 ?? "Sin telefono"}
            </p>
            <p>
              <span className="font-semibold text-app-text-soft">WhatsApp:</span>{" "}
              {lead.contact.whatsapp_id ?? "Sin WhatsApp"}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 lg:justify-end">
          <StatusBadge value={status} />
          {lead.owner.assignment_status ? (
            <StatusBadge value={lead.owner.assignment_status} />
          ) : null}
        </div>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl bg-app-surface-muted p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-app-text-soft">
            Origen
          </p>
          <p className="mt-2 font-medium text-app-text">
            {toSentenceCase(lead.origin.origin_type)}
          </p>
          <p className="mt-1 text-sm text-app-text-muted">
            {lead.origin.funnel_name ??
              lead.origin.source_channel ??
              "Origen pendiente"}
          </p>
          {lead.origin.instance_id ? (
            <p className="mt-1 text-xs text-app-text-soft">
              Instance {summarizeId(lead.origin.instance_id)}
            </p>
          ) : null}
        </div>

        <div className="rounded-2xl bg-app-surface-muted p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-app-text-soft">
            Owner
          </p>
          <p className="mt-2 font-medium text-app-text">
            {lead.owner.display_name ?? "Sin owner"}
          </p>
          <p className="mt-1 text-sm text-app-text-muted">
            {lead.owner.assigned_at
              ? `Asignado ${formatRelativeTime(lead.owner.assigned_at)}`
              : "Sin asignacion activa"}
          </p>
        </div>

        <div className="rounded-2xl bg-app-surface-muted p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-app-text-soft">
            Actividad
          </p>
          <p className="mt-2 font-medium text-app-text">
            {formatRelativeTime(lead.activity.last_activity_at)}
          </p>
          <p className="mt-1 text-sm text-app-text-muted">
            {formatDateTime(lead.activity.last_activity_at)}
          </p>
        </div>

        <div className="rounded-2xl bg-app-surface-muted p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-app-text-soft">
            Registro
          </p>
          <p className="mt-2 font-medium text-app-text">
            {summarizeId(getRecordId(lead))}
          </p>
          <p className="mt-1 text-sm text-app-text-muted">
            Actualizado {formatRelativeTime(lead.updated_at)}
          </p>
        </div>
      </div>

      {lead.activity.last_message ? (
        <div className="mt-4 rounded-2xl border border-app-border bg-app-surface px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-app-text-soft">
            Ultimo mensaje
          </p>
          <p className="mt-2 line-clamp-3 text-sm leading-6 text-app-text-muted">
            {lead.activity.last_message}
          </p>
        </div>
      ) : null}

      {lead.flags.possible_duplicate && matchedRecords.length > 0 ? (
        <details className="mt-4 rounded-2xl border border-app-warning-border bg-app-warning-bg px-4 py-3 text-app-warning-text">
          <summary className="cursor-pointer text-sm font-semibold">
            Coincidencias posibles
          </summary>
          <div className="mt-3 space-y-2">
            {matchedRecords.map((record) => (
              <div
                key={`${record.source}:${record.id}:${record.reason}`}
                className="rounded-xl border border-app-warning-border bg-app-card px-3 py-2 text-sm"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold">
                    {getSourceLabel(record.source)} · {summarizeId(record.id)}
                  </p>
                  <p>{formatPercent(record.confidence)}</p>
                </div>
                <p className="mt-1 text-xs">
                  {getDuplicateReasonLabel(record.reason)}
                </p>
              </div>
            ))}
          </div>
        </details>
      ) : null}
    </article>
  );
}

export function TeamCrmClient({ initialSnapshot }: TeamCrmClientProps) {
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [activeTab, setActiveTab] = useState<UnifiedCrmTab>("all");
  const [search, setSearch] = useState("");
  const [source, setSource] = useState<UnifiedCrmInboxSource>("all");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const deferredSearch = useDeferredValue(search);
  const didHydrate = useRef(false);

  useEffect(() => {
    if (!didHydrate.current) {
      didHydrate.current = true;
      return;
    }

    const controller = new AbortController();

    queueMicrotask(() => {
      if (!controller.signal.aborted) {
        setIsLoading(true);
        setErrorMessage(null);
      }
    });

    teamOperationRequest<UnifiedCrmInboxResponse>(
      buildInboxPath({
        tab: activeTab,
        q: deferredSearch,
        source,
      }),
      {
        method: "GET",
        signal: controller.signal,
      },
    )
      .then((nextSnapshot) => {
        setSnapshot(nextSnapshot);
      })
      .catch((error) => {
        if (error instanceof Error && error.name === "AbortError") {
          return;
        }

        setErrorMessage(
          error instanceof Error
            ? error.message
            : "No pudimos cargar el CRM unificado.",
        );
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      });

    return () => {
      controller.abort();
    };
  }, [activeTab, deferredSearch, source]);

  const hasSupabaseWarning =
    snapshot.diagnostics.supabase_enabled &&
    !snapshot.diagnostics.supabase_available;
  const rows = snapshot.data;
  const registeredCount = snapshot.counts.registrados;
  const conversationalCount = snapshot.counts.conversacionales;
  const visibleSourceLabel = useMemo(
    () =>
      sourceOptions.find((option) => option.value === source)?.label ??
      "Todas las fuentes",
    [source],
  );

  return (
    <div className="w-full min-w-0 space-y-8">
      <SectionHeader
        eyebrow="Team Admin / CRM Unificado"
        title="CRM unificado"
        description="Vista read-only para auditar leads registrados, conversaciones externas, owners y posibles duplicados sin modificar datos operativos."
        actions={
          <>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar por nombre, telefono, WhatsApp o funnel"
              className={`${filterControlClassName} min-w-72`}
            />
            <select
              value={source}
              onChange={(event) =>
                setSource(event.target.value as UnifiedCrmInboxSource)
              }
              aria-label="Fuente CRM"
              className={filterControlClassName}
            >
              {sourceOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </>
        }
      />

      {hasSupabaseWarning ? (
        <div className="rounded-2xl border border-app-warning-border bg-app-warning-bg px-4 py-3 text-sm text-app-warning-text">
          Conversaciones externas no disponibles temporalmente
          {snapshot.diagnostics.supabase_error
            ? ` (${snapshot.diagnostics.supabase_error})`
            : ""}
        </div>
      ) : null}

      {errorMessage ? (
        <div className="rounded-2xl border border-app-danger-border bg-app-danger-bg px-4 py-3 text-sm text-app-danger-text">
          {errorMessage}
        </div>
      ) : null}

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
        <KpiCard
          label="Todos"
          value={formatCompactNumber(snapshot.counts.todos)}
          hint="Registros visibles entre LeadFlow y conversaciones externas."
        />
        <KpiCard
          label="Registrados"
          value={formatCompactNumber(registeredCount)}
          hint="Leads capturados en LeadFlow."
        />
        <KpiCard
          label="Conversacionales"
          value={formatCompactNumber(conversationalCount)}
          hint="Contactos leidos desde WhatsApp/Supabase."
        />
        <KpiCard
          label="Duplicados"
          value={formatCompactNumber(snapshot.counts.posibles_duplicados)}
          hint="Identidades con coincidencias posibles."
        />
        <KpiCard
          label="Sin owner"
          value={formatCompactNumber(snapshot.counts.sin_owner)}
          hint="Registros sin responsable asignado."
        />
      </section>

      <section className="rounded-[1.75rem] border border-app-border bg-app-surface p-3 shadow-[0_18px_48px_rgba(15,23,42,0.05)]">
        <div className="flex flex-wrap gap-2">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.value;

            return (
              <button
                key={tab.value}
                type="button"
                onClick={() => setActiveTab(tab.value)}
                className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
                  isActive
                    ? "border-app-accent bg-app-accent text-app-accent-contrast"
                    : "border-app-border bg-app-card text-app-text hover:border-app-border-strong"
                }`}
              >
                {tab.label} · {formatCompactNumber(snapshot.counts[tab.countKey])}
              </button>
            );
          })}
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-app-text">
              {formatCompactNumber(rows.length)} registros en esta vista
            </p>
            <p className="text-sm text-app-text-muted">
              Fuente: {visibleSourceLabel}
              {isLoading ? " · Actualizando..." : ""}
            </p>
          </div>
        </div>

        {isLoading && rows.length === 0 ? (
          <div className="rounded-[1.5rem] border border-dashed border-app-border bg-app-card px-5 py-10 text-center text-sm text-app-text-muted">
            Cargando CRM unificado...
          </div>
        ) : null}

        {!isLoading && rows.length === 0 ? (
          <div className="rounded-[1.5rem] border border-dashed border-app-border bg-app-card px-5 py-10 text-center">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-app-text-soft">
              Sin resultados
            </p>
            <h2 className="mt-3 text-xl font-semibold text-app-text">
              No hay leads para mostrar
            </h2>
            <p className="mt-2 text-sm text-app-text-muted">
              Ajusta el tab, la busqueda o la fuente para ampliar la vista.
            </p>
          </div>
        ) : null}

        <div className="grid gap-4">
          {rows.map((lead) => (
            <LeadCard key={lead.id} lead={lead} />
          ))}
        </div>
      </section>
    </div>
  );
}
