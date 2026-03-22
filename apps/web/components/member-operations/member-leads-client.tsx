"use client";

import { useEffect, useState } from "react";
import { DataTable } from "@/components/app-shell/data-table";
import { KpiCard } from "@/components/app-shell/kpi-card";
import { SectionHeader } from "@/components/app-shell/section-header";
import { StatusBadge } from "@/components/app-shell/status-badge";
import { LeadSignalTimeline } from "@/components/lead-signals/lead-signal-timeline";
import { ModalShell } from "@/components/team-operations/modal-shell";
import { OperationBanner } from "@/components/team-operations/operation-banner";
import type { AssignmentRecord, LeadView } from "@/lib/app-shell/types";
import {
  listLeadConversationSignals,
  type LeadConversationSignal,
} from "@/lib/conversation-signals";
import { formatCompactNumber, formatDateTime } from "@/lib/app-shell/utils";
import { memberOperationRequest } from "@/lib/member-operations";

type MemberLeadsClientProps = {
  initialRows: LeadView[];
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

export function MemberLeadsClient({ initialRows }: MemberLeadsClientProps) {
  const [rows, setRows] = useState(initialRows);
  const [search, setSearch] = useState("");
  const [leadStatus, setLeadStatus] = useState<(typeof leadStatusOptions)[number]>(
    "all",
  );
  const [assignmentStatus, setAssignmentStatus] = useState<
    (typeof assignmentStatusOptions)[number]
  >("all");
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [signals, setSignals] = useState<LeadConversationSignal[]>([]);
  const [signalsLoading, setSignalsLoading] = useState(false);
  const [signalsError, setSignalsError] = useState<string | null>(null);
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

    return Boolean(matchesSearch && matchesLeadStatus && matchesAssignmentStatus);
  });

  const selectedLead =
    filteredRows.find((row) => row.id === selectedLeadId) ??
    rows.find((row) => row.id === selectedLeadId) ??
    null;

  useEffect(() => {
    if (!selectedLeadId) {
      setSignals([]);
      setSignalsError(null);
      setSignalsLoading(false);
      return;
    }

    let ignore = false;

    const loadSignals = async () => {
      setSignalsLoading(true);
      setSignalsError(null);

      try {
        const nextSignals = await listLeadConversationSignals(selectedLeadId);

        if (!ignore) {
          setSignals(nextSignals);
        }
      } catch (error) {
        if (!ignore) {
          setSignalsError(
            error instanceof Error
              ? error.message
              : "No pudimos cargar las señales de conversación.",
          );
        }
      } finally {
        if (!ignore) {
          setSignalsLoading(false);
        }
      }
    };

    void loadSignals();

    return () => {
      ignore = true;
    };
  }, [selectedLeadId]);

  const updateLeadRow = (
    leadId: string,
    updates: Partial<LeadView>,
  ) => {
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
        description="Esta vista ya es operativa: filtra, revisa detalle básico y mueve el seguimiento del lead sin entrar todavía en un inbox conversacional."
      />

      {feedback ? (
        <OperationBanner tone={feedback.tone} message={feedback.message} />
      ) : null}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Leads"
          value={formatCompactNumber(rows.length)}
          hint="Leads asignados al sponsor autenticado."
        />
        <KpiCard
          label="Por aceptar"
          value={formatCompactNumber(
            rows.filter((item) => item.assignmentStatus === "assigned").length,
          )}
          hint="Handoffs aún pendientes de aceptación."
        />
        <KpiCard
          label="En nurturing"
          value={formatCompactNumber(
            rows.filter((item) => item.status === "nurturing").length,
          )}
          hint="Leads ya tomados en seguimiento activo."
        />
        <KpiCard
          label="Ganados"
          value={formatCompactNumber(
            rows.filter((item) => item.status === "won").length,
          )}
          hint="Cierre positivo informado desde la operación del member."
        />
      </section>

      <section className="grid gap-3 rounded-3xl border border-slate-200 bg-white p-5 shadow-[0_18px_45px_rgba(15,23,42,0.05)] md:grid-cols-3">
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
              setLeadStatus(event.target.value as (typeof leadStatusOptions)[number])
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
          <span className="font-medium text-slate-700">Estado del assignment</span>
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
          description="Detalle operativo básico del lead para tomarlo, mover su seguimiento o cerrarlo."
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
            </dl>

            <LeadSignalTimeline
              signals={signals}
              loading={signalsLoading}
              error={signalsError}
              emptyDescription="Todavía no llegaron señales entrantes para este lead."
            />

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
                      loadingAction === `accept:${selectedLead.currentAssignmentId}`
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
                      disabled={loadingAction === `lead:${selectedLead.id}:${status}`}
                      onClick={() => handleLeadStatusChange(selectedLead, status)}
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
                      loadingAction === `close:${selectedLead.currentAssignmentId}`
                    }
                    onClick={() => handleCloseAssignment(selectedLead)}
                  >
                    Cerrar assignment
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        </ModalShell>
      ) : null}
    </div>
  );
}
