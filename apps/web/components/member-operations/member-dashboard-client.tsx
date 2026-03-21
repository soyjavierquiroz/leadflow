"use client";

import { useState } from "react";
import { DataTable } from "@/components/app-shell/data-table";
import { KpiCard } from "@/components/app-shell/kpi-card";
import { SectionHeader } from "@/components/app-shell/section-header";
import { SponsorCard } from "@/components/app-shell/sponsor-card";
import { StatusBadge } from "@/components/app-shell/status-badge";
import { OperationBanner } from "@/components/team-operations/operation-banner";
import type { AssignmentRecord, LeadView, SponsorRecord } from "@/lib/app-shell/types";
import { formatCompactNumber, formatDateTime } from "@/lib/app-shell/utils";
import { memberOperationRequest } from "@/lib/member-operations";

type MemberDashboardClientProps = {
  sponsor: SponsorRecord;
  leads: LeadView[];
  assignments: AssignmentRecord[];
};

export function MemberDashboardClient({
  sponsor,
  leads,
  assignments,
}: MemberDashboardClientProps) {
  const [currentSponsor, setCurrentSponsor] = useState(sponsor);
  const [currentLeads, setCurrentLeads] = useState(leads);
  const [currentAssignments, setCurrentAssignments] = useState(assignments);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{
    tone: "success" | "error";
    message: string;
  } | null>(null);

  const openAssignments = currentAssignments.filter(
    (item) => item.resolvedAt === null,
  );
  const acceptedAssignments = currentAssignments.filter(
    (item) => item.status === "accepted",
  );
  const availableLeads = currentLeads.filter(
    (item) => item.assignmentStatus === "assigned",
  );

  const handleAvailabilityChange = async (
    availabilityStatus: "available" | "paused" | "offline",
  ) => {
    setLoadingAction(`availability:${availabilityStatus}`);
    setFeedback(null);

    try {
      const updatedSponsor = await memberOperationRequest<SponsorRecord>(
        "/sponsors/me",
        {
          method: "PATCH",
          body: JSON.stringify({ availabilityStatus }),
        },
      );

      setCurrentSponsor(updatedSponsor);
      setFeedback({
        tone: "success",
        message: `Disponibilidad actualizada a ${availabilityStatus}.`,
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

  const handleAcceptLead = async (lead: LeadView) => {
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

      setCurrentAssignments((current) =>
        current.map((item) =>
          item.id === updatedAssignment.id ? updatedAssignment : item,
        ),
      );
      setCurrentLeads((current) =>
        current.map((item) =>
          item.id === lead.id
            ? {
                ...item,
                assignmentStatus: updatedAssignment.status,
                status: item.status === "assigned" ? "nurturing" : item.status,
              }
            : item,
        ),
      );
      setFeedback({
        tone: "success",
        message: "Lead aceptado y movido a seguimiento activo.",
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

  return (
    <div className="space-y-8">
      <SectionHeader
        eyebrow="Sponsor / Member"
        title="Operación diaria del member"
        description="Esta vista ya trabaja con leads asignados reales, disponibilidad operativa y acciones rápidas para tomar handoffs sin salir del shell."
      />

      {feedback ? (
        <OperationBanner tone={feedback.tone} message={feedback.message} />
      ) : null}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Leads asignados"
          value={formatCompactNumber(currentLeads.length)}
          hint="Total de oportunidades actualmente asociadas a este sponsor."
        />
        <KpiCard
          label="Por aceptar"
          value={formatCompactNumber(availableLeads.length)}
          hint="Handoffs nuevos listos para ser tomados por el member."
        />
        <KpiCard
          label="Seguimiento activo"
          value={formatCompactNumber(openAssignments.length)}
          hint="Assignments todavía abiertos o en proceso."
        />
        <KpiCard
          label="Aceptados"
          value={formatCompactNumber(acceptedAssignments.length)}
          hint="Leads ya tomados explícitamente por el sponsor."
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
        <SponsorCard
          sponsor={currentSponsor}
          leadCount={currentLeads.length}
          assignmentCount={currentAssignments.length}
          actions={
            <>
              <button
                type="button"
                className="rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={loadingAction !== null}
                onClick={() => handleAvailabilityChange("available")}
              >
                Estoy disponible
              </button>
              <button
                type="button"
                className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={loadingAction !== null}
                onClick={() => handleAvailabilityChange("paused")}
              >
                Pausar nuevos leads
              </button>
            </>
          }
        />

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
              header: "Entrada",
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
              key: "assignedAt",
              header: "Asignado",
              render: (row: LeadView) =>
                row.assignedAt ? formatDateTime(row.assignedAt) : "Pendiente",
            },
            {
              key: "status",
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
              key: "actions",
              header: "Acción",
              render: (row: LeadView) =>
                row.assignmentStatus === "assigned" && row.currentAssignmentId ? (
                  <button
                    type="button"
                    className="rounded-full bg-slate-950 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={loadingAction === `accept:${row.currentAssignmentId}`}
                    onClick={() => handleAcceptLead(row)}
                  >
                    Aceptar lead
                  </button>
                ) : (
                  <span className="text-xs text-slate-500">Sin acción rápida</span>
                ),
            },
          ]}
          rows={currentLeads.slice(0, 5)}
          emptyTitle="Sin leads asignados"
          emptyDescription="Cuando el runtime te rote nuevos leads, aparecerán aquí para tomar acción."
        />
      </section>
    </div>
  );
}
