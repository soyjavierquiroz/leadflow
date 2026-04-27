"use client";

import { useState } from "react";
import { DataTable } from "@/components/app-shell/data-table";
import { KpiCard } from "@/components/app-shell/kpi-card";
import { LeadSourceBadge } from "@/components/app-shell/lead-source-badge";
import { PremiumSelect } from "@/components/app-shell/premium-select";
import { SectionHeader } from "@/components/app-shell/section-header";
import { StatusBadge } from "@/components/app-shell/status-badge";
import { LeadQualificationTimelinePanel } from "@/components/lead-signals/lead-qualification-timeline-panel";
import { ModalShell } from "@/components/team-operations/modal-shell";
import { OperationBanner } from "@/components/team-operations/operation-banner";
import type {
  AssignmentRecord,
  LeadRemindersSummary,
  LeadView,
} from "@/lib/app-shell/types";
import {
  formatCompactNumber,
  formatDateTime,
  toSentenceCase,
} from "@/lib/app-shell/utils";
import { memberOperationRequest } from "@/lib/member-operations";

type MemberLeadsClientProps = {
  initialRows: LeadView[];
  remindersSummary: LeadRemindersSummary;
};

const mutableLeadStatuses = [
  "qualified",
  "nurturing",
  "won",
  "lost",
] as const;

type MutableLeadStatus = (typeof mutableLeadStatuses)[number];

const leadStatusOptions = [
  "all",
  "qualified",
  "assigned",
  "nurturing",
  "won",
  "lost",
] as const;

const assignmentStatusOptions = [
  "all",
  "assigned",
  "accepted",
  "closed",
] as const;

const reminderBucketOptions = [
  "all",
  "overdue",
  "due_today",
  "upcoming",
  "unscheduled",
] as const;

const sourceFilterOptions = [
  {
    value: "all",
    label: "Todas las fuentes",
    description: "Orgánico y campañas",
  },
  {
    value: "organic",
    label: "Orgánicos",
    description: "Directo y orgánico",
  },
  {
    value: "paid",
    label: "Campañas pagadas",
    description: "Ruedas publicitarias",
  },
] as const;

type SourceFilter = (typeof sourceFilterOptions)[number]["value"];

const leadStatusLabel: Record<(typeof leadStatusOptions)[number], string> = {
  all: "Todos",
  qualified: "Calificado",
  assigned: "Asignado",
  nurturing: "En seguimiento",
  won: "Ganado",
  lost: "Perdido",
};

const assignmentStatusLabel: Record<
  (typeof assignmentStatusOptions)[number],
  string
> = {
  all: "Todos",
  assigned: "Asignado",
  accepted: "Aceptado",
  closed: "Cerrado",
};

type MemberLeadStatusMutationResponse = Pick<
  LeadView,
  | "id"
  | "status"
  | "qualificationGrade"
  | "summaryText"
  | "nextActionLabel"
  | "followUpAt"
  | "lastContactedAt"
  | "lastQualifiedAt"
  | "reminderBucket"
  | "reminderLabel"
  | "suggestedNextAction"
  | "effectiveNextAction"
  | "playbookKey"
  | "playbookTitle"
  | "playbookDescription"
  | "needsAttention"
  | "updatedAt"
>;

const buildOptimisticLeadStatusUpdate = (
  lead: LeadView,
  nextStatus: MutableLeadStatus,
): Partial<LeadView> => {
  const now = new Date().toISOString();
  const baseUpdate: Partial<LeadView> = {
    status: nextStatus,
    updatedAt: now,
  };

  if (nextStatus === "won") {
    return {
      ...baseUpdate,
      assignmentStatus: lead.assignmentStatus ? "closed" : lead.assignmentStatus,
      reminderBucket: "none",
      reminderLabel: "Sin seguimiento activo",
      needsAttention: false,
      lastQualifiedAt: now,
      playbookKey: "won_handoff",
      playbookTitle: "Cierre ganado",
      playbookDescription:
        "Consolidar el cierre, confirmar el siguiente paso y evitar que el lead quede sin handoff operativo.",
      suggestedNextAction: "Confirmar onboarding y dejar cierre documentado.",
      effectiveNextAction:
        lead.nextActionLabel ?? "Confirmar onboarding y dejar cierre documentado.",
    };
  }

  if (nextStatus === "lost") {
    return {
      ...baseUpdate,
      assignmentStatus: lead.assignmentStatus ? "closed" : lead.assignmentStatus,
      reminderBucket: "none",
      reminderLabel: "Sin seguimiento activo",
      needsAttention: false,
      playbookKey: "lost_recycle",
      playbookTitle: "Reciclaje de perdida",
      playbookDescription:
        "Registrar por que se perdio la oportunidad y dejarla lista para reactivacion futura si aplica.",
      suggestedNextAction:
        "Registrar motivo de perdida y definir si entra a reciclaje.",
      effectiveNextAction:
        lead.nextActionLabel ??
        "Registrar motivo de perdida y definir si entra a reciclaje.",
    };
  }

  if (nextStatus === "qualified") {
    return {
      ...baseUpdate,
      lastQualifiedAt: now,
      playbookKey: "high_intent_close",
      playbookTitle: "Alta intencion",
      playbookDescription:
        "Lead con senales de cierre. La operacion debe avanzar hacia llamada, propuesta o siguiente decision comercial.",
      suggestedNextAction:
        "Llevar el lead a llamada o propuesta con seguimiento corto.",
      effectiveNextAction:
        lead.nextActionLabel ??
        "Llevar el lead a llamada o propuesta con seguimiento corto.",
    };
  }

  return {
    ...baseUpdate,
    playbookKey: "active_nurture",
    playbookTitle: "Nurturing activo",
    playbookDescription:
      "El lead ya entro en conversacion y necesita seguimiento constante sin sobreoperarlo.",
    suggestedNextAction:
      "Enviar seguimiento con contexto y confirmar el siguiente paso.",
    effectiveNextAction:
      lead.nextActionLabel ??
      "Enviar seguimiento con contexto y confirmar el siguiente paso.",
  };
};

export function MemberLeadsClient({
  initialRows,
  remindersSummary,
}: MemberLeadsClientProps) {
  const panelClassName =
    "rounded-[1.75rem] border border-[var(--app-border)] bg-[var(--app-surface)] p-5 shadow-[0_18px_45px_rgba(15,23,42,0.05)]";
  const filterFieldClassName =
    "w-full rounded-2xl border border-[var(--app-border)] bg-[var(--app-card)] px-4 py-2.5 text-sm text-[var(--app-text)] outline-none transition placeholder:text-[var(--app-text-soft)] focus:border-[var(--app-border-strong)] focus:ring-2 focus:ring-[var(--app-accent-soft)]";
  const detailButtonClassName =
    "rounded-full border border-[var(--app-border)] bg-[var(--app-card)] px-3 py-1.5 text-xs font-semibold text-[var(--app-text)] transition hover:border-[var(--app-border-strong)] hover:bg-[var(--app-surface-muted)]";
  const primaryActionClassName =
    "rounded-full bg-[var(--app-text)] px-4 py-2 text-sm font-semibold text-[var(--app-bg)] transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60";
  const secondaryActionClassName =
    "rounded-full border border-[var(--app-border)] bg-[var(--app-card)] px-4 py-2 text-sm font-semibold text-[var(--app-text)] transition hover:border-[var(--app-border-strong)] hover:bg-[var(--app-surface-muted)] disabled:cursor-not-allowed disabled:opacity-60";
  const dangerActionClassName =
    "rounded-full border border-[var(--app-danger-border)] bg-[var(--app-danger-soft)] px-4 py-2 text-sm font-semibold text-[var(--app-danger)] transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60";

  const [rows, setRows] = useState(initialRows);
  const [search, setSearch] = useState("");
  const [leadStatus, setLeadStatus] =
    useState<(typeof leadStatusOptions)[number]>("all");
  const [assignmentStatus, setAssignmentStatus] =
    useState<(typeof assignmentStatusOptions)[number]>("all");
  const [reminderBucket, setReminderBucket] =
    useState<(typeof reminderBucketOptions)[number]>("all");
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all");
  const [openSelectId, setOpenSelectId] = useState<string | null>(null);
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{
    tone: "success" | "error";
    message: string;
  } | null>(null);

  const searchTerm = search.trim().toLowerCase();
  const filteredRows = rows.filter((row) => {
    const matchesSearch =
      searchTerm.length === 0 ||
      row.fullName?.toLowerCase().includes(searchTerm) ||
      row.email?.toLowerCase().includes(searchTerm) ||
      row.phone?.toLowerCase().includes(searchTerm) ||
      row.companyName?.toLowerCase().includes(searchTerm) ||
      row.funnelName?.toLowerCase().includes(searchTerm) ||
      row.originAdWheelName?.toLowerCase().includes(searchTerm);

    const matchesLeadStatus = leadStatus === "all" || row.status === leadStatus;
    const matchesAssignmentStatus =
      assignmentStatus === "all" || row.assignmentStatus === assignmentStatus;
    const matchesReminderBucket =
      reminderBucket === "all" || row.reminderBucket === reminderBucket;
    const matchesSource =
      sourceFilter === "all" ||
      (sourceFilter === "paid"
        ? row.trafficLayer === "PAID_WHEEL"
        : row.trafficLayer !== "PAID_WHEEL");

    return Boolean(
      matchesSearch &&
      matchesLeadStatus &&
      matchesAssignmentStatus &&
      matchesSource &&
      matchesReminderBucket,
    );
  });

  const selectedLead =
    filteredRows.find((row) => row.id === selectedLeadId) ??
    rows.find((row) => row.id === selectedLeadId) ??
    null;
  const hotLeadCount = filteredRows.filter(
    (row) => row.qualificationGrade === "hot",
  ).length;
  const reminderMetrics =
    rows.length === 0
      ? remindersSummary.totals
      : rows.reduce(
          (summary, row) => {
            if (row.reminderBucket === "none") {
              return summary;
            }

            summary.active += 1;

            if (row.needsAttention) {
              summary.needsAttention += 1;
            }

            switch (row.reminderBucket) {
              case "overdue":
                summary.overdue += 1;
                break;
              case "due_today":
                summary.dueToday += 1;
                break;
              case "upcoming":
                summary.upcoming += 1;
                break;
              case "unscheduled":
                summary.unscheduled += 1;
                break;
              default:
                break;
            }

            return summary;
          },
          {
            active: 0,
            overdue: 0,
            dueToday: 0,
            upcoming: 0,
            unscheduled: 0,
            needsAttention: 0,
          },
        );
  const pendingAcceptanceCount = filteredRows.filter(
    (row) => row.assignmentStatus === "assigned",
  ).length;
  const attentionCount = filteredRows.filter(
    (row) => row.needsAttention,
  ).length;

  const updateLeadRow = (leadId: string, updates: Partial<LeadView>) => {
    setRows((current) =>
      current.map((row) => (row.id === leadId ? { ...row, ...updates } : row)),
    );
  };

  const handleAcceptAssignment = async (lead: LeadView) => {
    if (!lead.currentAssignmentId) {
      return;
    }

    setLoadingAction(`accept:${lead.currentAssignmentId}`);
    setFeedback(null);

    try {
      const acceptedLead = await memberOperationRequest<{
        ok: true;
        leadId: string;
        sponsorId: string;
        assignmentId: string;
        assignmentStatus: AssignmentRecord["status"];
        leadStatus: LeadView["status"];
        acceptedAt: string;
        alreadyAccepted: boolean;
      }>(`/sponsors/me/leads/${lead.id}/accept`, {
        method: "POST",
      });

      updateLeadRow(lead.id, {
        assignmentStatus: acceptedLead.assignmentStatus,
        status: acceptedLead.leadStatus,
      });
      setFeedback({
        tone: "success",
        message: "Lead aceptado correctamente.",
      });
    } catch (error) {
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

  const handleLeadStatusChange = async (
    lead: LeadView,
    nextStatus: MutableLeadStatus,
  ) => {
    const previousLead = rows.find((row) => row.id === lead.id);

    if (!previousLead) {
      return;
    }

    setLoadingAction(`lead:${lead.id}:${nextStatus}`);
    setFeedback(null);
    updateLeadRow(lead.id, buildOptimisticLeadStatusUpdate(previousLead, nextStatus));

    try {
      const updatedLead =
        await memberOperationRequest<MemberLeadStatusMutationResponse>(
          `/sponsors/me/leads/${lead.id}/status`,
          {
            method: "PATCH",
            body: JSON.stringify({ status: nextStatus }),
          },
        );

      updateLeadRow(lead.id, {
        ...updatedLead,
        assignmentStatus:
          nextStatus === "won" || nextStatus === "lost"
            ? "closed"
            : previousLead.assignmentStatus,
      });
      setFeedback({
        tone: "success",
        message: `Lead movido a ${leadStatusLabel[nextStatus].toLowerCase()}.`,
      });
    } catch (error) {
      updateLeadRow(lead.id, previousLead);
      setFeedback({
        tone: "error",
        message:
          error instanceof Error
            ? error.message
            : "No pudimos actualizar el estado del lead.",
      });
    } finally {
      setLoadingAction(null);
    }
  };

  const handleCloseAssignment = async (lead: LeadView) => {
    if (!lead.currentAssignmentId) {
      return;
    }

    setLoadingAction(`close:${lead.currentAssignmentId}`);
    setFeedback(null);

    try {
      const updatedAssignment = await memberOperationRequest<AssignmentRecord>(
        `/assignments/${lead.currentAssignmentId}`,
        {
          method: "PATCH",
          body: JSON.stringify({ status: "closed" }),
        },
      );

      updateLeadRow(lead.id, {
        assignmentStatus: updatedAssignment.status,
      });
      setFeedback({
        tone: "success",
        message: "Assignment cerrado correctamente.",
      });
    } catch (error) {
      setFeedback({
        tone: "error",
        message:
          error instanceof Error
            ? error.message
            : "No pudimos cerrar el assignment.",
      });
    } finally {
      setLoadingAction(null);
    }
  };

  return (
    <div className="space-y-8">
      <SectionHeader
        eyebrow="Sponsor / Member / Leads"
        title="Mi bandeja de seguimiento"
        description="Aquí ordenas tus leads por prioridad, follow-up y próxima acción sugerida para que el trabajo diario sea más claro y menos reactivo."
      />

      {feedback ? (
        <OperationBanner tone={feedback.tone} message={feedback.message} />
      ) : null}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Vencidos"
          value={formatCompactNumber(reminderMetrics.overdue)}
          hint="Seguimientos que ya debieron resolverse."
        />
        <KpiCard
          label="Hoy"
          value={formatCompactNumber(reminderMetrics.dueToday)}
          hint="Leads que requieren follow-up hoy."
        />
        <KpiCard
          label="Próximos"
          value={formatCompactNumber(reminderMetrics.upcoming)}
          hint="Seguimientos ya agendados para los próximos días."
        />
        <KpiCard
          label="Sin follow-up"
          value={formatCompactNumber(reminderMetrics.unscheduled)}
          hint="Leads activos que todavía no tienen una próxima fecha."
        />
      </section>

      <section className="grid gap-4 xl:grid-cols-3">
        <div className={panelClassName}>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--app-text-soft)]">
            Bandeja filtrada
          </p>
          <p className="mt-3 text-2xl font-semibold tracking-tight text-[var(--app-text)]">
            {formatCompactNumber(filteredRows.length)} leads visibles
          </p>
          <p className="mt-2 text-sm leading-6 text-[var(--app-muted)]">
            Ajusta filtros para quedarte solo con la carga que vas a mover hoy.
          </p>
        </div>
        <div className={panelClassName}>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--app-text-soft)]">
            Handoffs por tomar
          </p>
          <p className="mt-3 text-2xl font-semibold tracking-tight text-[var(--app-text)]">
            {formatCompactNumber(pendingAcceptanceCount)} esperando respuesta
          </p>
          <p className="mt-2 text-sm leading-6 text-[var(--app-muted)]">
            Tómalos primero si quieres bajar fricción entre assignment y
            seguimiento.
          </p>
        </div>
        <div className={panelClassName}>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--app-text-soft)]">
            Prioridad comercial
          </p>
          <p className="mt-3 text-2xl font-semibold tracking-tight text-[var(--app-text)]">
            {formatCompactNumber(hotLeadCount + attentionCount)} leads calientes
            o en riesgo
          </p>
          <p className="mt-2 text-sm leading-6 text-[var(--app-muted)]">
            Mezcla intención alta y necesidad de atención para ordenar tu foco.
          </p>
        </div>
      </section>

      <section className="grid gap-3 rounded-3xl border border-[var(--app-border)] bg-[var(--app-surface)] p-5 shadow-[0_18px_45px_rgba(15,23,42,0.05)] md:grid-cols-2 xl:grid-cols-5">
        <label className="space-y-2 text-sm">
          <span className="font-medium text-[var(--app-text)]">Buscar lead</span>
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Nombre, email, telefono o funnel"
            className={filterFieldClassName}
          />
        </label>
        <label className="space-y-2 text-sm">
          <span className="font-medium text-[var(--app-text)]">Estado del lead</span>
          <select
            value={leadStatus}
            onChange={(event) =>
              setLeadStatus(
                event.target.value as (typeof leadStatusOptions)[number],
              )
            }
            className={filterFieldClassName}
          >
            {leadStatusOptions.map((option) => (
              <option key={option} value={option}>
                {leadStatusLabel[option]}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-2 text-sm">
          <span className="font-medium text-[var(--app-text)]">
            Estado del assignment
          </span>
          <select
            value={assignmentStatus}
            onChange={(event) =>
              setAssignmentStatus(
                event.target.value as (typeof assignmentStatusOptions)[number],
              )
            }
            className={filterFieldClassName}
          >
            {assignmentStatusOptions.map((option) => (
              <option key={option} value={option}>
                {assignmentStatusLabel[option]}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-2 text-sm">
          <span className="font-medium text-[var(--app-text)]">Seguimiento</span>
          <select
            value={reminderBucket}
            onChange={(event) =>
              setReminderBucket(
                event.target.value as (typeof reminderBucketOptions)[number],
              )
            }
            className={filterFieldClassName}
          >
            {reminderBucketOptions.map((option) => (
              <option key={option} value={option}>
                {option === "all" ? "Todos" : toSentenceCase(option)}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-2 text-sm">
          <span className="font-medium text-[var(--app-text)]">Fuente</span>
          <PremiumSelect
            id="member-lead-source-filter"
            value={sourceFilter}
            placeholder="Fuente"
            options={sourceFilterOptions}
            open={openSelectId === "source"}
            onOpenChange={(open) => setOpenSelectId(open ? "source" : null)}
            onValueChange={(value) => setSourceFilter(value as SourceFilter)}
          />
        </label>
      </section>

      <DataTable
        columns={[
          {
            key: "lead",
            header: "Lead",
            render: (row: LeadView) => (
              <div>
                <p className="font-semibold text-[var(--app-text)]">
                  {row.fullName ?? "Lead sin nombre"}
                </p>
                <p className="text-xs text-[var(--app-text-soft)]">
                  {row.companyName ?? row.email ?? row.phone ?? "Sin contacto"}
                </p>
              </div>
            ),
          },
          {
            key: "origin",
            header: "Origen comercial",
            render: (row: LeadView) => (
              <div className="space-y-3">
                <p>{row.publicationPath ?? "Sin publicación"}</p>
                <p className="text-xs text-[var(--app-text-soft)]">
                  {row.domainHost ?? "Host pendiente"}
                </p>
                <LeadSourceBadge
                  trafficLayer={row.trafficLayer}
                  originAdWheelName={row.originAdWheelName}
                />
              </div>
            ),
          },
          {
            key: "statuses",
            header: "Estado y prioridad",
            render: (row: LeadView) => (
              <div className="flex flex-wrap gap-2">
                <StatusBadge value={row.status} />
                {row.assignmentStatus ? (
                  <StatusBadge value={row.assignmentStatus} />
                ) : null}
                {row.qualificationGrade ? (
                  <StatusBadge value={row.qualificationGrade} />
                ) : null}
                {row.reminderBucket !== "none" ? (
                  <StatusBadge value={row.reminderBucket} />
                ) : null}
              </div>
            ),
          },
          {
            key: "nextAction",
            header: "Siguiente acción",
            render: (row: LeadView) =>
              row.effectiveNextAction ??
              row.summaryText ??
              "Pendiente de definir",
          },
          {
            key: "playbook",
            header: "Playbook",
            render: (row: LeadView) => row.playbookTitle ?? "Sin recomendación",
          },
          {
            key: "followUp",
            header: "Seguimiento",
            render: (row: LeadView) => (
              <div>
                <p>{row.reminderLabel ?? "Sin seguimiento"}</p>
                <p className="text-xs text-[var(--app-text-soft)]">
                  {row.followUpAt
                    ? formatDateTime(row.followUpAt)
                    : "Sin fecha"}
                </p>
              </div>
            ),
          },
          {
            key: "assignedAt",
            header: "Entró a mi bandeja",
            render: (row: LeadView) =>
              row.assignedAt ? formatDateTime(row.assignedAt) : "Pendiente",
          },
          {
            key: "actions",
            header: "Detalle",
            render: (row: LeadView) => (
              <button
                type="button"
                className={detailButtonClassName}
                onClick={() => setSelectedLeadId(row.id)}
              >
                Ver detalle
              </button>
            ),
          },
        ]}
        rows={filteredRows}
        emptyTitle="Sin leads asignados"
        emptyDescription="Cuando el sistema te asigne nuevos handoffs, aparecerán aquí con prioridad, siguiente acción y seguimiento."
      />

      {selectedLead ? (
        <ModalShell
          title={selectedLead.fullName ?? "Lead sin nombre"}
          description="Detalle operativo del lead con reminder, próxima acción efectiva y playbook recomendado para decidir el siguiente movimiento."
          onClose={() => setSelectedLeadId(null)}
        >
          <div className="space-y-5">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-card)] p-4 text-sm">
                <p className="text-[var(--app-text-soft)]">Contacto</p>
                <p className="mt-2 font-medium text-[var(--app-text)]">
                  {selectedLead.email ?? "Sin email"}
                </p>
                <p className="mt-1 text-[var(--app-muted)]">
                  {selectedLead.phone ?? "Sin teléfono"}
                </p>
              </div>
              <div className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-card)] p-4 text-sm">
                <p className="text-[var(--app-text-soft)]">Contexto</p>
                <p className="mt-2 font-medium text-[var(--app-text)]">
                  {selectedLead.funnelName ?? "Funnel pendiente"}
                </p>
                <p className="mt-1 text-[var(--app-muted)]">
                  {selectedLead.domainHost ?? "Host pendiente"}
                  {selectedLead.publicationPath ?? ""}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <LeadSourceBadge
                trafficLayer={selectedLead.trafficLayer}
                originAdWheelName={selectedLead.originAdWheelName}
              />
              <StatusBadge value={selectedLead.status} />
              {selectedLead.assignmentStatus ? (
                <StatusBadge value={selectedLead.assignmentStatus} />
              ) : null}
              {selectedLead.qualificationGrade ? (
                <StatusBadge value={selectedLead.qualificationGrade} />
              ) : null}
              {selectedLead.reminderBucket !== "none" ? (
                <StatusBadge value={selectedLead.reminderBucket} />
              ) : null}
            </div>

            <dl className="grid gap-3 text-sm md:grid-cols-2">
              <div>
                <dt className="text-[var(--app-text-soft)]">Empresa</dt>
                <dd className="mt-1 font-medium text-[var(--app-text)]">
                  {selectedLead.companyName ?? "Sin empresa"}
                </dd>
              </div>
              <div>
                <dt className="text-[var(--app-text-soft)]">Canal</dt>
                <dd className="mt-1 font-medium text-[var(--app-text)]">
                  {selectedLead.sourceChannel}
                </dd>
              </div>
              <div>
                <dt className="text-[var(--app-text-soft)]">Creado</dt>
                <dd className="mt-1 font-medium text-[var(--app-text)]">
                  {formatDateTime(selectedLead.createdAt)}
                </dd>
              </div>
              <div>
                <dt className="text-[var(--app-text-soft)]">Asignado</dt>
                <dd className="mt-1 font-medium text-[var(--app-text)]">
                  {selectedLead.assignedAt
                    ? formatDateTime(selectedLead.assignedAt)
                    : "Pendiente"}
                </dd>
              </div>
              <div>
                <dt className="text-[var(--app-text-soft)]">Playbook recomendado</dt>
                <dd className="mt-1 font-medium text-[var(--app-text)]">
                  {selectedLead.playbookTitle ?? "Sin recomendación"}
                </dd>
              </div>
              <div>
                <dt className="text-[var(--app-text-soft)]">Próxima acción efectiva</dt>
                <dd className="mt-1 font-medium text-[var(--app-text)]">
                  {selectedLead.effectiveNextAction ?? "Pendiente de definir"}
                </dd>
              </div>
            </dl>

            <div className="space-y-3 rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] p-4">
              <p className="text-sm font-semibold text-[var(--app-text)]">
                Acciones de seguimiento
              </p>
              <div className="flex flex-wrap gap-2">
                {selectedLead.assignmentStatus === "assigned" &&
                selectedLead.currentAssignmentId ? (
                  <button
                    type="button"
                    className={primaryActionClassName}
                    disabled={
                      loadingAction ===
                      `accept:${selectedLead.currentAssignmentId}`
                    }
                    onClick={() => handleAcceptAssignment(selectedLead)}
                  >
                    Tomar handoff
                  </button>
                ) : null}

                {mutableLeadStatuses.map((status) => (
                  <button
                    key={status}
                    type="button"
                    className={secondaryActionClassName}
                    disabled={
                      loadingAction === `lead:${selectedLead.id}:${status}` ||
                      selectedLead.status === status
                    }
                    onClick={() => handleLeadStatusChange(selectedLead, status)}
                  >
                    Mover a {leadStatusLabel[status].toLowerCase()}
                  </button>
                ))}

                {selectedLead.currentAssignmentId ? (
                  <button
                    type="button"
                    className={dangerActionClassName}
                    disabled={
                      loadingAction ===
                      `close:${selectedLead.currentAssignmentId}`
                    }
                    onClick={() => handleCloseAssignment(selectedLead)}
                  >
                    Cerrar handoff
                  </button>
                ) : null}
              </div>
            </div>

            <LeadQualificationTimelinePanel
              key={`${selectedLead.id}:${selectedLead.updatedAt}`}
              leadId={selectedLead.id}
              onLeadChange={(leadId, updates) => updateLeadRow(leadId, updates)}
            />
          </div>
        </ModalShell>
      ) : null}
    </div>
  );
}
