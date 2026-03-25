"use client";

import { useState } from "react";
import { DataTable } from "@/components/app-shell/data-table";
import { KpiCard } from "@/components/app-shell/kpi-card";
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

export function MemberLeadsClient({
  initialRows,
  remindersSummary,
}: MemberLeadsClientProps) {
  const [rows, setRows] = useState(initialRows);
  const [search, setSearch] = useState("");
  const [leadStatus, setLeadStatus] =
    useState<(typeof leadStatusOptions)[number]>("all");
  const [assignmentStatus, setAssignmentStatus] =
    useState<(typeof assignmentStatusOptions)[number]>("all");
  const [reminderBucket, setReminderBucket] =
    useState<(typeof reminderBucketOptions)[number]>("all");
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
      row.funnelName?.toLowerCase().includes(searchTerm);

    const matchesLeadStatus = leadStatus === "all" || row.status === leadStatus;
    const matchesAssignmentStatus =
      assignmentStatus === "all" || row.assignmentStatus === assignmentStatus;
    const matchesReminderBucket =
      reminderBucket === "all" || row.reminderBucket === reminderBucket;

    return Boolean(
      matchesSearch &&
      matchesLeadStatus &&
      matchesAssignmentStatus &&
      matchesReminderBucket,
    );
  });

  const selectedLead =
    filteredRows.find((row) => row.id === selectedLeadId) ??
    rows.find((row) => row.id === selectedLeadId) ??
    null;

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
      const updatedAssignment = await memberOperationRequest<AssignmentRecord>(
        `/assignments/${lead.currentAssignmentId}`,
        {
          method: "PATCH",
          body: JSON.stringify({ status: "accepted" }),
        },
      );

      updateLeadRow(lead.id, {
        assignmentStatus: updatedAssignment.status,
        status: lead.status === "assigned" ? "nurturing" : lead.status,
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
    nextStatus: "qualified" | "nurturing" | "won" | "lost",
  ) => {
    setLoadingAction(`lead:${lead.id}:${nextStatus}`);
    setFeedback(null);

    try {
      await memberOperationRequest(`/leads/${lead.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: nextStatus }),
      });

      updateLeadRow(lead.id, {
        status: nextStatus,
        assignmentStatus:
          nextStatus === "won" || nextStatus === "lost"
            ? "closed"
            : lead.assignmentStatus,
      });
      setFeedback({
        tone: "success",
        message: `Lead movido a ${nextStatus}.`,
      });
    } catch (error) {
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
        title="Mis leads asignados"
        description="Bandeja operativa para priorizar follow-ups vencidos, ver qué toca hoy y trabajar cada lead con la próxima acción sugerida y su playbook recomendado."
      />

      {feedback ? (
        <OperationBanner tone={feedback.tone} message={feedback.message} />
      ) : null}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Vencidos"
          value={formatCompactNumber(remindersSummary.totals.overdue)}
          hint="Seguimientos que ya debieron resolverse."
        />
        <KpiCard
          label="Hoy"
          value={formatCompactNumber(remindersSummary.totals.dueToday)}
          hint="Leads que requieren follow-up hoy."
        />
        <KpiCard
          label="Próximos"
          value={formatCompactNumber(remindersSummary.totals.upcoming)}
          hint="Seguimientos ya agendados para los próximos días."
        />
        <KpiCard
          label="Sin follow-up"
          value={formatCompactNumber(remindersSummary.totals.unscheduled)}
          hint="Leads activos que todavía no tienen una próxima fecha."
        />
      </section>

      <section className="grid gap-3 rounded-3xl border border-slate-200 bg-white p-5 shadow-[0_18px_45px_rgba(15,23,42,0.05)] md:grid-cols-2 xl:grid-cols-4">
        <label className="space-y-2 text-sm">
          <span className="font-medium text-slate-700">Buscar lead</span>
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Nombre, email, teléfono o funnel"
            className="w-full rounded-2xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 outline-none transition focus:border-slate-400"
          />
        </label>
        <label className="space-y-2 text-sm">
          <span className="font-medium text-slate-700">Estado del lead</span>
          <select
            value={leadStatus}
            onChange={(event) =>
              setLeadStatus(
                event.target.value as (typeof leadStatusOptions)[number],
              )
            }
            className="w-full rounded-2xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 outline-none transition focus:border-slate-400"
          >
            {leadStatusOptions.map((option) => (
              <option key={option} value={option}>
                {option === "all" ? "Todos" : option}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-2 text-sm">
          <span className="font-medium text-slate-700">
            Estado del assignment
          </span>
          <select
            value={assignmentStatus}
            onChange={(event) =>
              setAssignmentStatus(
                event.target.value as (typeof assignmentStatusOptions)[number],
              )
            }
            className="w-full rounded-2xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 outline-none transition focus:border-slate-400"
          >
            {assignmentStatusOptions.map((option) => (
              <option key={option} value={option}>
                {option === "all" ? "Todos" : option}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-2 text-sm">
          <span className="font-medium text-slate-700">Seguimiento</span>
          <select
            value={reminderBucket}
            onChange={(event) =>
              setReminderBucket(
                event.target.value as (typeof reminderBucketOptions)[number],
              )
            }
            className="w-full rounded-2xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 outline-none transition focus:border-slate-400"
          >
            {reminderBucketOptions.map((option) => (
              <option key={option} value={option}>
                {option === "all" ? "Todos" : toSentenceCase(option)}
              </option>
            ))}
          </select>
        </label>
      </section>

      <DataTable
        columns={[
          {
            key: "lead",
            header: "Lead",
            render: (row: LeadView) => (
              <div>
                <p className="font-semibold text-slate-950">
                  {row.fullName ?? "Lead sin nombre"}
                </p>
                <p className="text-xs text-slate-500">
                  {row.companyName ?? row.email ?? row.phone ?? "Sin contacto"}
                </p>
              </div>
            ),
          },
          {
            key: "origin",
            header: "Origen",
            render: (row: LeadView) => (
              <div>
                <p>{row.publicationPath ?? "Sin publicación"}</p>
                <p className="text-xs text-slate-500">
                  {row.domainHost ?? "Host pendiente"}
                </p>
              </div>
            ),
          },
          {
            key: "statuses",
            header: "Estado",
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
            header: "Follow-up",
            render: (row: LeadView) => (
              <div>
                <p>{row.reminderLabel ?? "Sin seguimiento"}</p>
                <p className="text-xs text-slate-500">
                  {row.followUpAt
                    ? formatDateTime(row.followUpAt)
                    : "Sin fecha"}
                </p>
              </div>
            ),
          },
          {
            key: "assignedAt",
            header: "Asignado",
            render: (row: LeadView) =>
              row.assignedAt ? formatDateTime(row.assignedAt) : "Pendiente",
          },
          {
            key: "actions",
            header: "Detalle",
            render: (row: LeadView) => (
              <button
                type="button"
                className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-900 transition hover:bg-slate-50"
                onClick={() => setSelectedLeadId(row.id)}
              >
                Ver detalle
              </button>
            ),
          },
        ]}
        rows={filteredRows}
        emptyTitle="Sin leads asignados"
        emptyDescription="Cuando el sistema te asigne handoffs nuevos, aparecerán en esta bandeja operativa."
      />

      {selectedLead ? (
        <ModalShell
          title={selectedLead.fullName ?? "Lead sin nombre"}
          description="Detalle operativo del lead con reminder, próxima acción efectiva y playbook recomendado para decidir el siguiente movimiento."
          onClose={() => setSelectedLeadId(null)}
        >
          <div className="space-y-5">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl bg-slate-50 p-4 text-sm">
                <p className="text-slate-500">Contacto</p>
                <p className="mt-2 font-medium text-slate-950">
                  {selectedLead.email ?? "Sin email"}
                </p>
                <p className="mt-1 text-slate-700">
                  {selectedLead.phone ?? "Sin teléfono"}
                </p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4 text-sm">
                <p className="text-slate-500">Contexto</p>
                <p className="mt-2 font-medium text-slate-950">
                  {selectedLead.funnelName ?? "Funnel pendiente"}
                </p>
                <p className="mt-1 text-slate-700">
                  {selectedLead.domainHost ?? "Host pendiente"}
                  {selectedLead.publicationPath ?? ""}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
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
                <dt className="text-slate-500">Empresa</dt>
                <dd className="mt-1 font-medium text-slate-900">
                  {selectedLead.companyName ?? "Sin empresa"}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500">Canal</dt>
                <dd className="mt-1 font-medium text-slate-900">
                  {selectedLead.sourceChannel}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500">Creado</dt>
                <dd className="mt-1 font-medium text-slate-900">
                  {formatDateTime(selectedLead.createdAt)}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500">Asignado</dt>
                <dd className="mt-1 font-medium text-slate-900">
                  {selectedLead.assignedAt
                    ? formatDateTime(selectedLead.assignedAt)
                    : "Pendiente"}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500">Playbook recomendado</dt>
                <dd className="mt-1 font-medium text-slate-900">
                  {selectedLead.playbookTitle ?? "Sin recomendación"}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500">Próxima acción efectiva</dt>
                <dd className="mt-1 font-medium text-slate-900">
                  {selectedLead.effectiveNextAction ?? "Pendiente de definir"}
                </dd>
              </div>
            </dl>

            <div className="space-y-3 rounded-2xl border border-slate-200 p-4">
              <p className="text-sm font-semibold text-slate-900">
                Acciones de seguimiento
              </p>
              <div className="flex flex-wrap gap-2">
                {selectedLead.assignmentStatus === "assigned" &&
                selectedLead.currentAssignmentId ? (
                  <button
                    type="button"
                    className="rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={
                      loadingAction ===
                      `accept:${selectedLead.currentAssignmentId}`
                    }
                    onClick={() => handleAcceptAssignment(selectedLead)}
                  >
                    Aceptar lead
                  </button>
                ) : null}

                {(["qualified", "nurturing", "won", "lost"] as const).map(
                  (status) => (
                    <button
                      key={status}
                      type="button"
                      className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                      disabled={
                        loadingAction === `lead:${selectedLead.id}:${status}`
                      }
                      onClick={() =>
                        handleLeadStatusChange(selectedLead, status)
                      }
                    >
                      Marcar {status}
                    </button>
                  ),
                )}

                {selectedLead.currentAssignmentId ? (
                  <button
                    type="button"
                    className="rounded-full border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={
                      loadingAction ===
                      `close:${selectedLead.currentAssignmentId}`
                    }
                    onClick={() => handleCloseAssignment(selectedLead)}
                  >
                    Cerrar assignment
                  </button>
                ) : null}
              </div>
            </div>

            <LeadQualificationTimelinePanel
              leadId={selectedLead.id}
              onLeadChange={(leadId, updates) => updateLeadRow(leadId, updates)}
            />
          </div>
        </ModalShell>
      ) : null}
    </div>
  );
}
