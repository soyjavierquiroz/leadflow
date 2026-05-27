"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  Clock3,
  Inbox,
  Loader2,
  RefreshCw,
  Search,
  ShieldCheck,
} from "lucide-react";
import {
  memo,
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { ReactNode } from "react";
import { SectionHeader } from "@/components/app-shell/section-header";
import { memberOperationRequest } from "@/lib/member-operations";
import {
  acceptAssignment,
  buildAdvisorCrmInboxPath,
  type AcceptedAdvisorCrmAssignment,
  type AdvisorCrmInboxResponse,
  type AdvisorCrmInboxSource,
  type AdvisorCrmInboxTab,
  type AdvisorCrmLead,
  type AdvisorCrmStatusFilter,
} from "@/lib/member-crm";
import {
  formatCompactNumber,
  formatDateTime,
  formatRelativeTime,
  toSentenceCase,
} from "@/lib/app-shell/utils";

type AdvisorCrmClientProps = {
  initialSnapshot: AdvisorCrmInboxResponse;
  initialSearch: string;
  initialSource: AdvisorCrmInboxSource;
  initialStatus: AdvisorCrmStatusFilter;
  initialTab: AdvisorCrmInboxTab;
};

const tabs = [
  {
    value: "all",
    label: "Todos",
    countKey: "todos",
  },
  {
    value: "handoffs",
    label: "Pendientes",
    countKey: "handoffs",
  },
  {
    value: "active",
    label: "Activos",
    countKey: "activos",
  },
  {
    value: "external_matches",
    label: "Coincidencias externas",
    countKey: "external_matches",
  },
  {
    value: "duplicates",
    label: "Posibles duplicados",
    countKey: "duplicados",
  },
] as const satisfies Array<{
  value: AdvisorCrmInboxTab;
  label: string;
  countKey: keyof AdvisorCrmInboxResponse["counts"];
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
    label: "Supabase",
  },
] as const satisfies Array<{
  value: AdvisorCrmInboxSource;
  label: string;
}>;

const statusOptions = [
  {
    value: "all",
    label: "Todos los estados",
  },
  {
    value: "pending",
    label: "Pendiente legacy",
  },
  {
    value: "assigned",
    label: "Asignado legacy",
  },
  {
    value: "pending_assignment",
    label: "Pendiente",
  },
  {
    value: "accepted",
    label: "Aceptado",
  },
  {
    value: "auto_accepted",
    label: "Auto aceptado",
  },
  {
    value: "reassigned",
    label: "Reasignado",
  },
  {
    value: "closed",
    label: "Cerrado",
  },
  {
    value: "conversation_started",
    label: "Conversacion iniciada",
  },
] as const satisfies Array<{
  value: AdvisorCrmStatusFilter;
  label: string;
}>;

const filterControlClassName =
  "h-10 w-full rounded-full border border-app-border bg-app-card px-4 text-sm text-app-text outline-none transition placeholder:text-app-text-soft focus:border-app-border-strong focus:ring-2 focus:ring-app-accent-soft md:w-auto [&>option]:bg-app-card [&>option]:text-app-text";

const assignmentToneClassName = {
  pending: "border-app-warning-border bg-app-warning-bg text-app-warning-text",
  pending_assignment:
    "border-app-warning-border bg-app-warning-bg text-app-warning-text",
  assigned: "border-app-accent bg-app-accent-soft text-app-accent",
  accepted: "border-app-success-border bg-app-success-bg text-app-success-text",
  auto_accepted:
    "border-app-success-border bg-app-success-bg text-app-success-text",
  reassigned: "border-app-border bg-app-surface-muted text-app-text-muted",
  closed: "border-app-border bg-app-surface-muted text-app-text-muted",
  fallback: "border-app-border bg-app-surface-muted text-app-text-muted",
} satisfies Record<string, string>;

const assignmentCardClassName = {
  pending:
    "border-l-app-warning-text shadow-[0_18px_44px_rgba(245,158,11,0.08)]",
  pending_assignment:
    "border-l-app-warning-text shadow-[0_18px_44px_rgba(245,158,11,0.08)]",
  assigned: "border-l-app-accent shadow-[0_18px_44px_rgba(14,165,233,0.08)]",
  accepted:
    "border-l-app-success-text shadow-[0_18px_44px_rgba(16,185,129,0.08)]",
  auto_accepted:
    "border-l-app-success-text shadow-[0_18px_44px_rgba(16,185,129,0.1)]",
  reassigned: "border-l-app-border shadow-[0_14px_34px_rgba(15,23,42,0.05)]",
  closed: "border-l-app-border shadow-[0_14px_34px_rgba(15,23,42,0.05)]",
  fallback: "border-l-app-border shadow-[0_14px_34px_rgba(15,23,42,0.05)]",
} satisfies Record<string, string>;

const lifecycleStatusLabel = {
  pending: "Pendiente",
  assigned: "Pendiente",
  pending_assignment: "Pendiente",
  accepted: "Aceptado",
  auto_accepted: "Auto aceptado",
  expired: "Expirado",
  reassigned: "Reasignado",
  closed: "Cerrado",
} satisfies Record<string, string>;

const ownershipSourceLabel = {
  conversation_owner: "Owner conversacion",
  accepted_assignment: "Aceptado",
  assigned_sponsor: "Asignado",
  attribution: "Atribucion MLM",
  unowned: "Sin owner",
} satisfies Record<string, string>;

const sourceBadgeClassName = {
  leadflow: "border-app-accent bg-app-accent-soft text-app-accent",
  supabase: "border-app-success-border bg-app-success-bg text-app-success-text",
  merged_candidate:
    "border-app-warning-border bg-app-warning-bg text-app-warning-text",
} satisfies Record<AdvisorCrmLead["source"], string>;

const duplicateReasonLabel = {
  same_phone: "Mismo telefono",
  same_whatsapp: "Mismo WhatsApp",
  phone_matches_whatsapp: "Telefono coincide con WhatsApp",
} satisfies Record<string, string>;

const originLabel = {
  wheel: "wheel",
  organic: "organic",
  whatsapp_owner: "whatsapp_owner",
  imported: "imported",
  manual: "manual",
} as const;

const getLeadTitle = (lead: AdvisorCrmLead) =>
  lead.contact.display_name ??
  lead.contact.phone_e164 ??
  lead.contact.whatsapp_id ??
  "Contacto sin nombre";

const getSourceLabel = (source: AdvisorCrmLead["source"]) => {
  if (source === "leadflow") {
    return "LeadFlow";
  }

  if (source === "supabase") {
    return "Supabase";
  }

  return "Candidato merge";
};

const getAssignmentStatus = (lead: AdvisorCrmLead) =>
  lead.advisor_context.assignment_status ??
  lead.owner.assignment_status ??
  "assigned";

const getAssignmentTone = (lead: AdvisorCrmLead) => {
  const assignmentStatus = getAssignmentStatus(lead);

  if (
    assignmentStatus === "pending" ||
    assignmentStatus === "assigned" ||
    assignmentStatus === "pending_assignment" ||
    assignmentStatus === "accepted" ||
    assignmentStatus === "auto_accepted" ||
    assignmentStatus === "reassigned" ||
    assignmentStatus === "closed"
  ) {
    return assignmentStatus;
  }

  return "fallback";
};

const getLeadStatus = (lead: AdvisorCrmLead) =>
  lead.leadflow?.status ?? lead.supabase?.status ?? null;

const getLatestMessage = (lead: AdvisorCrmLead) =>
  lead.advisor_context.latest_external_message ??
  lead.activity.last_message ??
  "Sin ultimo mensaje registrado";

const getLatestActivityAt = (lead: AdvisorCrmLead) =>
  lead.activity.last_activity_at ??
  lead.advisor_context.latest_external_message_at ??
  lead.updated_at;

const getOrigin = (lead: AdvisorCrmLead): keyof typeof originLabel => {
  const assignmentSource = lead.advisor_context.assignment_source;

  if (
    assignmentSource === "wheel" ||
    assignmentSource === "organic" ||
    assignmentSource === "manual"
  ) {
    return assignmentSource;
  }

  if (assignmentSource === "whatsapp_inbound") {
    return "whatsapp_owner";
  }

  if (assignmentSource === "campaign") {
    return "wheel";
  }

  const trafficLayer = lead.origin.traffic_layer?.toLowerCase() ?? "";
  const sourceChannel = lead.origin.source_channel?.toLowerCase() ?? "";

  if (trafficLayer.includes("wheel") || sourceChannel.includes("wheel")) {
    return "wheel";
  }

  if (lead.origin.origin_type === "whatsapp") {
    return "whatsapp_owner";
  }

  if (sourceChannel.includes("import") || trafficLayer.includes("import")) {
    return "imported";
  }

  if (lead.origin.origin_type === "manual") {
    return "manual";
  }

  return "organic";
};

const getSponsorPath = (lead: AdvisorCrmLead) => {
  const ownerName = lead.owner.display_name ?? "Sponsor owner";
  const shortOwnerId = lead.owner.sponsor_id
    ? summarizeId(lead.owner.sponsor_id)
    : "sin-id";

  return `${ownerName} / ${shortOwnerId}`;
};

const summarizeId = (value: string) =>
  value.length > 14 ? `${value.slice(0, 8)}...${value.slice(-4)}` : value;

const formatPercent = (value: number) => `${Math.round(value * 100)}%`;

const addHoursIso = (value: Date, hours: number) =>
  new Date(value.getTime() + hours * 60 * 60 * 1000).toISOString();

const isOwnershipLocked = (lead: AdvisorCrmLead) => {
  const lockedUntil = lead.advisor_context.ownership_locked_until;

  if (!lockedUntil) {
    return false;
  }

  const timestamp = new Date(lockedUntil).getTime();
  return Number.isFinite(timestamp) && timestamp > Date.now();
};

const getLifecycleLabel = (status: string) =>
  lifecycleStatusLabel[status as keyof typeof lifecycleStatusLabel] ??
  toSentenceCase(status);

const getOwnershipSourceLabel = (source: string | null | undefined) =>
  source
    ? (ownershipSourceLabel[source as keyof typeof ownershipSourceLabel] ??
      toSentenceCase(source))
    : "Sin owner";

const getShortSponsorName = (
  sponsor: { id: string; display_name: string } | null | undefined,
) =>
  sponsor?.display_name ??
  (sponsor?.id ? summarizeId(sponsor.id) : "Sin sponsor");

const getEmptyStateCopy = (
  tab: AdvisorCrmInboxTab,
  source: AdvisorCrmInboxSource,
) => {
  if (tab === "handoffs") {
    return {
      title: "No tienes handoffs pendientes",
      description:
        "Cuando recibas un handoff operativo pendiente, aparecera aqui para aceptarlo.",
    };
  }

  if (tab === "active") {
    return {
      title: "No tienes conversaciones activas",
      description:
        "Los leads aceptados o auto aceptados por conversacion apareceran en esta vista.",
    };
  }

  if (tab === "external_matches" || source === "supabase") {
    return {
      title: "No hay coincidencias externas",
      description:
        "Cuando una conversacion externa coincida por telefono o WhatsApp, aparecera aqui sin mezclar el universo del team.",
    };
  }

  return {
    title: "Aun no tienes leads asignados",
    description:
      "Los handoffs y conversaciones asignadas a tu sponsor apareceran en esta bandeja.",
  };
};

const mergeRowsById = (
  currentRows: AdvisorCrmLead[],
  nextRows: AdvisorCrmLead[],
  allowedIds?: Set<string>,
) => {
  const incoming = new Map(nextRows.map((row) => [row.id, row]));

  return currentRows.map((row) => {
    if (allowedIds && !allowedIds.has(row.id)) {
      return row;
    }

    return incoming.get(row.id) ?? row;
  });
};

const applyAcceptedAssignment = (
  lead: AdvisorCrmLead,
  assignment: AcceptedAdvisorCrmAssignment,
): AdvisorCrmLead => ({
  ...lead,
  owner: {
    ...lead.owner,
    assignment_status: assignment.assignmentStatus,
    accepted_at: assignment.acceptedAt,
    assigned_at: assignment.assignedAt,
    sponsor_id: assignment.acceptedBySponsorId ?? lead.owner.sponsor_id,
  },
  advisor_context: {
    ...lead.advisor_context,
    assignment_id: assignment.id,
    crm_assignment_id: assignment.id,
    assignment_status: assignment.assignmentStatus,
    assignment_source: assignment.assignmentSource,
    accepted_at: assignment.acceptedAt ?? new Date().toISOString(),
    assigned_at: assignment.assignedAt ?? lead.advisor_context.assigned_at,
    ownership_locked_until:
      assignment.ownershipLockedUntil ?? addHoursIso(new Date(), 72),
    accepted_by_sponsor:
      lead.advisor_context.accepted_by_sponsor ??
      lead.advisor_context.assigned_sponsor,
    ownership_source: "accepted_assignment",
    outreach: {
      has_initial_contact_queued: true,
      status: "queued",
      intent_type: "initial_contact",
      created_at: new Date().toISOString(),
      scheduled_at: null,
    },
  },
});

const getDuplicateReasonLabel = (reason: string) =>
  duplicateReasonLabel[reason as keyof typeof duplicateReasonLabel] ??
  toSentenceCase(reason);

const hasConversationStarted = (lead: AdvisorCrmLead) =>
  Boolean(
    lead.advisor_context.has_external_conversation ||
    lead.activity.last_message ||
    lead.advisor_context.latest_external_message ||
    lead.leadflow?.status === "nurturing" ||
    lead.leadflow?.status === "qualified",
  );

const matchesSourceFilter = (
  lead: AdvisorCrmLead,
  source: AdvisorCrmInboxSource,
) => {
  if (source === "all" || source === "leadflow") {
    return true;
  }

  return lead.advisor_context.has_external_conversation;
};

const matchesClientStatusFilter = (
  lead: AdvisorCrmLead,
  status: AdvisorCrmStatusFilter,
) => {
  if (status === "all") {
    return true;
  }

  if (status === "conversation_started") {
    return hasConversationStarted(lead);
  }

  return String(getAssignmentStatus(lead)).includes(status);
};

const getVisibleTotal = (
  counts: AdvisorCrmInboxResponse["counts"],
  tab: AdvisorCrmInboxTab,
) => {
  const tabConfig = tabs.find((item) => item.value === tab);
  return tabConfig ? counts[tabConfig.countKey] : counts.todos;
};

const mergeUniqueRows = (
  currentRows: AdvisorCrmLead[],
  nextRows: AdvisorCrmLead[],
) => {
  const byId = new Map(currentRows.map((row) => [row.id, row]));

  nextRows.forEach((row) => {
    byId.set(row.id, row);
  });

  return Array.from(byId.values());
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
      className={`inline-flex min-h-7 items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${className}`}
    >
      {children}
    </span>
  );
}

function DetailBlock({
  label,
  primary,
  secondary,
}: {
  label: string;
  primary: ReactNode;
  secondary?: ReactNode;
}) {
  return (
    <div className="min-w-0 rounded-2xl bg-app-surface-muted p-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-app-text-soft">
        {label}
      </p>
      <div className="mt-1 min-w-0 break-words text-sm font-semibold text-app-text">
        {primary}
      </div>
      {secondary ? (
        <div className="mt-1 min-w-0 break-words text-xs leading-5 text-app-text-muted">
          {secondary}
        </div>
      ) : null}
    </div>
  );
}

const AdvisorLeadCard = memo(function AdvisorLeadCard({
  acceptError,
  isAccepting,
  lead,
  onAccept,
}: {
  acceptError?: string | null;
  isAccepting: boolean;
  lead: AdvisorCrmLead;
  onAccept: (lead: AdvisorCrmLead) => void;
}) {
  const assignmentStatus = getAssignmentStatus(lead);
  const assignmentTone = getAssignmentTone(lead);
  const latestActivityAt = getLatestActivityAt(lead);
  const latestMessage = getLatestMessage(lead);
  const leadStatus = getLeadStatus(lead);
  const externalMatches =
    lead.dedupe.matched_records?.filter(
      (record) => record.source === "supabase",
    ) ?? [];
  const duplicateMatches = lead.dedupe.matched_records ?? [];
  const origin = getOrigin(lead);
  const cardTone = assignmentCardClassName[assignmentTone];
  const statusTone = assignmentToneClassName[assignmentTone];
  const crmAssignmentId = lead.advisor_context.crm_assignment_id;
  const isLocked = isOwnershipLocked(lead);
  const canAccept =
    assignmentStatus === "pending_assignment" &&
    Boolean(crmAssignmentId) &&
    lead.advisor_context.is_current_sponsor_owner &&
    !isLocked;
  const hasQueuedOutreach =
    Boolean(lead.advisor_context.outreach?.has_initial_contact_queued) ||
    lead.advisor_context.outreach?.status === "queued";

  return (
    <article
      className={`overflow-hidden rounded-[1.25rem] border border-l-4 border-app-border bg-app-card p-4 ${cardTone}`}
    >
      <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <InlineBadge className={sourceBadgeClassName[lead.source]}>
              {getSourceLabel(lead.source)}
            </InlineBadge>
            <InlineBadge className={statusTone}>
              {getLifecycleLabel(assignmentStatus)}
            </InlineBadge>
            {isLocked ? (
              <InlineBadge className="border-app-accent bg-app-accent-soft text-app-accent">
                <span
                  className="inline-flex items-center gap-1"
                  title="Este lead tiene ownership protegido temporalmente"
                >
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Protegido
                </span>
              </InlineBadge>
            ) : null}
            {hasQueuedOutreach ? (
              <InlineBadge className="border-app-success-border bg-app-success-bg text-app-success-text">
                <span className="inline-flex items-center gap-1">
                  <Clock3 className="h-3.5 w-3.5" />
                  Contacto preparado
                </span>
              </InlineBadge>
            ) : null}
            {leadStatus ? (
              <InlineBadge className="border-app-border bg-app-surface-muted text-app-text-muted">
                {toSentenceCase(leadStatus)}
              </InlineBadge>
            ) : null}
          </div>

          <h2 className="mt-3 break-words text-lg font-semibold tracking-tight text-app-text">
            {getLeadTitle(lead)}
          </h2>
          <p className="mt-1 text-xs text-app-text-muted">
            Actividad {formatRelativeTime(latestActivityAt)} ·{" "}
            {formatDateTime(latestActivityAt)}
          </p>
        </div>

        {assignmentStatus === "pending_assignment" ||
        assignmentStatus === "pending" ? (
          <button
            type="button"
            onClick={() => onAccept(lead)}
            disabled={!canAccept || isAccepting}
            aria-label={`Aceptar lead ${getLeadTitle(lead)}`}
            aria-busy={isAccepting}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-full border border-app-warning-border bg-app-warning-bg px-4 text-sm font-semibold text-app-warning-text transition hover:border-app-warning-text disabled:cursor-not-allowed disabled:opacity-60"
            title={
              isLocked
                ? "Este lead tiene ownership protegido temporalmente"
                : crmAssignmentId
                  ? "Aceptar assignment CRM"
                  : "Este lead todavia no tiene assignment CRM operacional"
            }
          >
            {isAccepting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <CheckCircle2 className="h-4 w-4" />
            )}
            {isAccepting ? "Aceptando..." : "Aceptar lead"}
          </button>
        ) : null}
      </div>

      {assignmentStatus === "auto_accepted" ? (
        <div className="mt-4 rounded-2xl border border-app-success-border bg-app-success-bg px-3 py-2.5 text-sm font-semibold text-app-success-text">
          Asignado automaticamente por conversacion WhatsApp
        </div>
      ) : null}

      {acceptError ? (
        <div
          className="mt-4 flex items-start gap-2 rounded-2xl border border-app-danger-border bg-app-danger-bg px-3 py-2.5 text-sm text-app-danger-text"
          role="alert"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{acceptError}</span>
        </div>
      ) : null}

      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <DetailBlock
          label="Contacto"
          primary={lead.contact.phone_e164 ?? "Sin telefono"}
          secondary={
            <>
              <span>
                WhatsApp: {lead.contact.whatsapp_id ?? "Sin WhatsApp"}
              </span>
              {lead.contact.email ? (
                <span className="block">Email: {lead.contact.email}</span>
              ) : null}
            </>
          }
        />
        <DetailBlock
          label="Owner conversacion"
          primary={getShortSponsorName(lead.advisor_context.conversation_owner)}
          secondary={
            <>
              <span>
                Fuente:{" "}
                {getOwnershipSourceLabel(lead.advisor_context.ownership_source)}
              </span>
              {lead.advisor_context.latest_external_message_at ? (
                <span className="block">
                  Ultima conversacion{" "}
                  {formatRelativeTime(
                    lead.advisor_context.latest_external_message_at,
                  )}
                </span>
              ) : null}
            </>
          }
        />
        <DetailBlock
          label="Asignado a"
          primary={
            getShortSponsorName(lead.advisor_context.assigned_sponsor) ??
            lead.owner.display_name ??
            "Sin sponsor"
          }
          secondary={
            <>
              <span>{getSponsorPath(lead)}</span>
              {lead.advisor_context.assigned_at ? (
                <span className="block">
                  Asignado{" "}
                  {formatRelativeTime(lead.advisor_context.assigned_at)}
                </span>
              ) : null}
            </>
          }
        />
        <DetailBlock
          label="Atribucion MLM"
          primary={getShortSponsorName(lead.advisor_context.attributed_sponsor)}
          secondary={`Origen: ${originLabel[origin]}`}
        />
        <DetailBlock
          label="Estado lifecycle"
          primary={getLifecycleLabel(assignmentStatus)}
          secondary={
            lead.advisor_context.accepted_at
              ? `Aceptado ${formatRelativeTime(lead.advisor_context.accepted_at)}`
              : lead.advisor_context.assigned_at
                ? `Asignado ${formatRelativeTime(lead.advisor_context.assigned_at)}`
                : "Sin fecha de asignacion"
          }
        />
      </div>

      <div className="mt-3 rounded-2xl border border-app-border bg-app-surface-muted px-3 py-2.5">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-app-text-soft">
          Conversacion
        </p>
        <p className="mt-1 line-clamp-2 text-sm leading-5 text-app-text">
          {latestMessage}
        </p>
        <p className="mt-1 text-xs text-app-text-muted">
          {formatRelativeTime(latestActivityAt)}
        </p>
      </div>

      {externalMatches.length > 0 ? (
        <details className="mt-3 rounded-2xl border border-app-success-border bg-app-success-bg px-3 py-2.5 text-app-success-text">
          <summary className="cursor-pointer text-sm font-semibold">
            Coincidencias externas · {externalMatches.length}
          </summary>
          <div className="mt-2 grid gap-2 md:grid-cols-2">
            {externalMatches.map((match) => (
              <div
                key={`${match.source}:${match.id}:${match.reason}`}
                className="rounded-xl border border-app-success-border bg-app-card px-3 py-2 text-xs text-app-text"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold">
                    {lead.contact.display_name ?? "Contacto externo"}
                  </p>
                  <span className="font-semibold text-app-success-text">
                    {formatPercent(match.confidence)}
                  </span>
                </div>
                <p className="mt-1 text-app-text-muted">
                  Supabase · {getDuplicateReasonLabel(match.reason)}
                </p>
                <p className="mt-1 text-app-text-soft">
                  {lead.contact.whatsapp_id ??
                    lead.contact.phone_e164 ??
                    summarizeId(match.id)}
                </p>
              </div>
            ))}
          </div>
        </details>
      ) : null}

      {lead.flags.possible_duplicate && duplicateMatches.length > 0 ? (
        <div className="mt-3 rounded-2xl border border-app-warning-border bg-app-warning-bg px-3 py-2.5 text-app-warning-text">
          <p className="text-sm font-semibold">
            Posibles duplicados · {duplicateMatches.length}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {duplicateMatches.map((match) => (
              <span
                key={`${match.source}:${match.id}:${match.reason}`}
                className="inline-flex items-center rounded-full border border-app-warning-border bg-app-card px-2.5 py-1 text-xs font-semibold"
              >
                {getDuplicateReasonLabel(match.reason)} ·{" "}
                {formatPercent(match.confidence)}
              </span>
            ))}
          </div>
        </div>
      ) : null}
    </article>
  );
});

const LazyAdvisorLeadCard = memo(function LazyAdvisorLeadCard({
  acceptError,
  acceptingAssignmentId,
  lead,
  onAccept,
}: {
  acceptError?: string | null;
  acceptingAssignmentId: string | null;
  lead: AdvisorCrmLead;
  onAccept: (lead: AdvisorCrmLead) => void;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (isVisible) {
      return;
    }

    const node = ref.current;

    if (!node || typeof IntersectionObserver === "undefined") {
      queueMicrotask(() => setIsVisible(true));
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      {
        rootMargin: "900px 0px",
      },
    );

    observer.observe(node);

    return () => observer.disconnect();
  }, [isVisible]);

  return (
    <div ref={ref}>
      {isVisible ? (
        <AdvisorLeadCard
          acceptError={acceptError}
          isAccepting={
            Boolean(lead.advisor_context.crm_assignment_id) &&
            acceptingAssignmentId === lead.advisor_context.crm_assignment_id
          }
          lead={lead}
          onAccept={onAccept}
        />
      ) : (
        <div className="min-h-[22rem] rounded-[1.25rem] border border-app-border bg-app-card/70" />
      )}
    </div>
  );
});

function AdvisorLeadList({
  acceptingAssignmentId,
  acceptErrors,
  onAccept,
  rows,
}: {
  acceptingAssignmentId: string | null;
  acceptErrors: Record<string, string>;
  onAccept: (lead: AdvisorCrmLead) => void;
  rows: AdvisorCrmLead[];
}) {
  const shouldVirtualize = rows.length > 100;

  return (
    <div className="grid gap-4">
      {rows.map((lead) =>
        shouldVirtualize ? (
          <LazyAdvisorLeadCard
            key={lead.id}
            acceptError={acceptErrors[lead.id] ?? null}
            acceptingAssignmentId={acceptingAssignmentId}
            lead={lead}
            onAccept={onAccept}
          />
        ) : (
          <AdvisorLeadCard
            key={lead.id}
            acceptError={acceptErrors[lead.id] ?? null}
            isAccepting={
              Boolean(lead.advisor_context.crm_assignment_id) &&
              acceptingAssignmentId === lead.advisor_context.crm_assignment_id
            }
            lead={lead}
            onAccept={onAccept}
          />
        ),
      )}
    </div>
  );
}

export function AdvisorCrmClient({
  initialSearch,
  initialSnapshot,
  initialSource,
  initialStatus,
  initialTab,
}: AdvisorCrmClientProps) {
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [rows, setRows] = useState(initialSnapshot.data);
  const [nextCursor, setNextCursor] = useState(
    initialSnapshot.page.next_cursor ?? null,
  );
  const [activeTab, setActiveTab] = useState<AdvisorCrmInboxTab>(initialTab);
  const [search, setSearch] = useState(initialSearch);
  const [source, setSource] = useState<AdvisorCrmInboxSource>(initialSource);
  const [status, setStatus] = useState<AdvisorCrmStatusFilter>(initialStatus);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [acceptErrors, setAcceptErrors] = useState<Record<string, string>>({});
  const [acceptingAssignmentId, setAcceptingAssignmentId] = useState<
    string | null
  >(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const deferredSearch = useDeferredValue(search);
  const didHydrate = useRef(false);
  const requestSequence = useRef(0);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentQueryString = searchParams.toString();

  const visibleRows = useMemo(
    () =>
      rows.filter(
        (row) =>
          matchesSourceFilter(row, source) &&
          matchesClientStatusFilter(row, status),
      ),
    [rows, source, status],
  );

  const loadCurrentSnapshot = useCallback(
    async (options?: { focusRowIds?: Set<string>; replaceRows?: boolean }) => {
      setIsRefreshing(true);
      setErrorMessage(null);

      try {
        const nextSnapshot =
          await memberOperationRequest<AdvisorCrmInboxResponse>(
            buildAdvisorCrmInboxPath({
              tab: activeTab,
              limit: 50,
              q: deferredSearch.trim(),
              source,
              status,
            }),
            {
              method: "GET",
            },
          );

        setSnapshot(nextSnapshot);
        setRows((currentRows) =>
          options?.replaceRows
            ? nextSnapshot.data
            : mergeRowsById(
                currentRows,
                nextSnapshot.data,
                options?.focusRowIds,
              ),
        );
        setNextCursor(nextSnapshot.page.next_cursor ?? null);
      } catch (error) {
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "No pudimos refrescar la bandeja CRM.",
        );
      } finally {
        setIsRefreshing(false);
      }
    },
    [activeTab, deferredSearch, source, status],
  );

  useEffect(() => {
    if (!didHydrate.current) {
      didHydrate.current = true;
      return;
    }

    const controller = new AbortController();
    const requestId = requestSequence.current + 1;
    requestSequence.current = requestId;
    const trimmedSearch = deferredSearch.trim();

    queueMicrotask(() => {
      if (!controller.signal.aborted) {
        setIsRefreshing(true);
        setErrorMessage(null);
      }
    });

    memberOperationRequest<AdvisorCrmInboxResponse>(
      buildAdvisorCrmInboxPath({
        tab: activeTab,
        limit: 50,
        q: trimmedSearch,
        source,
        status,
      }),
      {
        method: "GET",
        signal: controller.signal,
      },
    )
      .then((nextSnapshot) => {
        if (requestSequence.current !== requestId) {
          return;
        }

        setSnapshot(nextSnapshot);
        setRows(nextSnapshot.data);
        setNextCursor(nextSnapshot.page.next_cursor ?? null);
      })
      .catch((error) => {
        if (error instanceof Error && error.name === "AbortError") {
          return;
        }

        setErrorMessage(
          error instanceof Error
            ? error.message
            : "No pudimos cargar la bandeja CRM del asesor.",
        );
      })
      .finally(() => {
        if (
          !controller.signal.aborted &&
          requestSequence.current === requestId
        ) {
          setIsRefreshing(false);
        }
      });

    return () => {
      controller.abort();
    };
  }, [activeTab, deferredSearch, source, status]);

  useEffect(() => {
    const trimmedSearch = deferredSearch.trim();
    const nextParams = new URLSearchParams(currentQueryString);

    if (activeTab === "all") {
      nextParams.delete("tab");
    } else {
      nextParams.set("tab", activeTab);
    }

    if (trimmedSearch) {
      nextParams.set("q", trimmedSearch);
    } else {
      nextParams.delete("q");
    }

    if (source === "all") {
      nextParams.delete("source");
    } else {
      nextParams.set("source", source);
    }

    if (status === "all") {
      nextParams.delete("status");
    } else {
      nextParams.set("status", status);
    }

    const queryString = nextParams.toString();

    if (queryString === currentQueryString) {
      return;
    }

    router.replace(queryString ? `${pathname}?${queryString}` : pathname, {
      scroll: false,
    });
  }, [
    activeTab,
    currentQueryString,
    deferredSearch,
    pathname,
    router,
    source,
    status,
  ]);

  const handleLoadMore = useCallback(() => {
    if (!nextCursor || isLoadingMore) {
      return;
    }

    setIsLoadingMore(true);
    setErrorMessage(null);

    memberOperationRequest<AdvisorCrmInboxResponse>(
      buildAdvisorCrmInboxPath({
        cursor: nextCursor,
        tab: activeTab,
        limit: 50,
        q: deferredSearch,
        source,
        status,
      }),
      {
        method: "GET",
      },
    )
      .then((nextSnapshot) => {
        setSnapshot((currentSnapshot) => ({
          ...nextSnapshot,
          counts: currentSnapshot.counts,
        }));
        setRows((currentRows) =>
          mergeUniqueRows(currentRows, nextSnapshot.data),
        );
        setNextCursor(nextSnapshot.page.next_cursor ?? null);
      })
      .catch((error) => {
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "No pudimos cargar mas leads del CRM.",
        );
      })
      .finally(() => {
        setIsLoadingMore(false);
      });
  }, [activeTab, deferredSearch, isLoadingMore, nextCursor, source, status]);

  const handleManualRefresh = useCallback(() => {
    void loadCurrentSnapshot({ replaceRows: true });
  }, [loadCurrentSnapshot]);

  const handleAcceptAssignment = useCallback(
    (lead: AdvisorCrmLead) => {
      const assignmentId = lead.advisor_context.crm_assignment_id;

      if (!assignmentId || acceptingAssignmentId) {
        return;
      }

      const previousLead = lead;
      const optimisticAcceptedAt = new Date().toISOString();

      setAcceptingAssignmentId(assignmentId);
      setAcceptErrors((current) => {
        const next = { ...current };
        delete next[lead.id];
        return next;
      });
      setRows((currentRows) =>
        currentRows.map((row) =>
          row.id === lead.id
            ? {
                ...row,
                owner: {
                  ...row.owner,
                  assignment_status: "accepted",
                  accepted_at: optimisticAcceptedAt,
                },
                advisor_context: {
                  ...row.advisor_context,
                  assignment_status: "accepted",
                  accepted_at: optimisticAcceptedAt,
                  ownership_locked_until:
                    row.advisor_context.ownership_locked_until ??
                    addHoursIso(new Date(), 72),
                  ownership_source: "accepted_assignment",
                },
              }
            : row,
        ),
      );

      acceptAssignment(assignmentId)
        .then((assignment) => {
          setRows((currentRows) =>
            currentRows.map((row) =>
              row.id === lead.id
                ? applyAcceptedAssignment(row, assignment)
                : row,
            ),
          );
          void loadCurrentSnapshot({
            focusRowIds: new Set([lead.id]),
          });
        })
        .catch((error) => {
          setRows((currentRows) =>
            currentRows.map((row) =>
              row.id === previousLead.id ? previousLead : row,
            ),
          );
          setAcceptErrors((current) => ({
            ...current,
            [lead.id]:
              error instanceof Error
                ? error.message
                : "No pudimos aceptar este lead. Intenta de nuevo.",
          }));
        })
        .finally(() => {
          setAcceptingAssignmentId(null);
        });
    },
    [acceptingAssignmentId, loadCurrentSnapshot],
  );

  const hasSupabaseWarning =
    snapshot.diagnostics.supabase_enabled &&
    !snapshot.diagnostics.supabase_available;
  const visibleTotal = getVisibleTotal(snapshot.counts, activeTab);
  const emptyCopy = getEmptyStateCopy(activeTab, source);

  return (
    <div className="w-full min-w-0 space-y-8">
      <SectionHeader
        eyebrow="Sponsor / Member / CRM"
        title="Bandeja CRM"
        description="Tu operacion personal: handoffs pendientes, conversaciones activas, coincidencias externas y posibles duplicados sin mostrar el universo del team."
        actions={
          <>
            <label className="relative w-full md:w-80">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-app-text-soft" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar por nombre, telefono, WhatsApp o email"
                aria-label="Buscar en CRM"
                className={`${filterControlClassName} pl-9 md:w-full`}
              />
            </label>
            <select
              value={source}
              onChange={(event) =>
                setSource(event.target.value as AdvisorCrmInboxSource)
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
            <select
              value={status}
              onChange={(event) =>
                setStatus(event.target.value as AdvisorCrmStatusFilter)
              }
              aria-label="Estado CRM"
              className={filterControlClassName}
            >
              {statusOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={handleManualRefresh}
              disabled={isRefreshing}
              aria-label="Refrescar bandeja CRM"
              aria-busy={isRefreshing}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-full border border-app-border bg-app-card px-4 text-sm font-semibold text-app-text transition hover:border-app-border-strong disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isRefreshing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              Refrescar
            </button>
          </>
        }
      />

      {hasSupabaseWarning ? (
        <div className="rounded-2xl border border-app-warning-border bg-app-warning-bg px-4 py-3 text-sm text-app-warning-text">
          Coincidencias externas no disponibles temporalmente
          {snapshot.diagnostics.supabase_error
            ? ` (${snapshot.diagnostics.supabase_error})`
            : ""}
        </div>
      ) : null}

      {snapshot.diagnostics.crm_candidate_limit_reached ? (
        <div className="rounded-2xl border border-app-warning-border bg-app-warning-bg px-4 py-3 text-sm text-app-warning-text">
          La bandeja alcanzo el limite interno de candidatos. Usa busqueda o
          filtros para una vista mas precisa.
        </div>
      ) : null}

      {errorMessage ? (
        <div className="rounded-2xl border border-app-danger-border bg-app-danger-bg px-4 py-3 text-sm text-app-danger-text">
          {errorMessage}
        </div>
      ) : null}

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
                {tab.label} ·{" "}
                {formatCompactNumber(snapshot.counts[tab.countKey])}
              </button>
            );
          })}
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-app-text">
              {formatCompactNumber(visibleRows.length)} leads en esta vista
            </p>
            <p className="text-sm text-app-text-muted">
              Mostrando solo tu ownership MLM y tus conversaciones
              {isRefreshing ? " · Actualizando..." : ""}
            </p>
          </div>
          {rows.length > 100 ? (
            <InlineBadge className="border-app-border bg-app-card text-app-text-muted">
              Lista virtualizada
            </InlineBadge>
          ) : null}
        </div>

        {isRefreshing && visibleRows.length === 0 ? (
          <div className="rounded-[1.5rem] border border-dashed border-app-border bg-app-card px-5 py-10 text-center text-sm text-app-text-muted">
            Cargando bandeja CRM...
          </div>
        ) : null}

        {!isRefreshing && visibleRows.length === 0 ? (
          <div className="rounded-[1.5rem] border border-dashed border-app-border bg-app-card px-5 py-10 text-center">
            <div className="mx-auto flex size-12 items-center justify-center rounded-2xl border border-app-border bg-app-surface">
              <Inbox className="h-5 w-5 text-app-text-soft" />
            </div>
            <h2 className="mt-4 text-xl font-semibold text-app-text">
              {emptyCopy.title}
            </h2>
            <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-app-text-muted">
              {emptyCopy.description}
            </p>
          </div>
        ) : null}

        {visibleRows.length > 0 ? (
          <AdvisorLeadList
            acceptingAssignmentId={acceptingAssignmentId}
            acceptErrors={acceptErrors}
            onAccept={handleAcceptAssignment}
            rows={visibleRows}
          />
        ) : null}

        <div className="flex flex-col items-center justify-between gap-3 rounded-[1.25rem] border border-app-border bg-app-surface px-4 py-3 text-sm text-app-text-muted sm:flex-row">
          <p>
            Mostrando {formatCompactNumber(visibleRows.length)} de{" "}
            {formatCompactNumber(visibleTotal)}
          </p>
          <button
            type="button"
            onClick={handleLoadMore}
            disabled={!nextCursor || isLoadingMore || isRefreshing}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-full border border-app-border bg-app-card px-4 text-sm font-semibold text-app-text transition hover:border-app-border-strong disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isLoadingMore ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
            {isLoadingMore
              ? "Cargando..."
              : nextCursor
                ? "Cargar mas"
                : "No hay mas registros"}
          </button>
        </div>
      </section>
    </div>
  );
}
