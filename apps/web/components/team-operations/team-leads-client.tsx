"use client";

import {
  useDeferredValue,
  useMemo,
  useState,
  useTransition,
} from "react";
import { DataTable } from "@/components/app-shell/data-table";
import { KpiCard } from "@/components/app-shell/kpi-card";
import { SectionHeader } from "@/components/app-shell/section-header";
import { StatusBadge } from "@/components/app-shell/status-badge";
import { ModalShell } from "@/components/team-operations/modal-shell";
import { OperationBanner } from "@/components/team-operations/operation-banner";
import {
  type TeamLeadAvailableSponsor,
  type TeamLeadInboxItem,
  type TeamLeadReassignResponse,
} from "@/lib/team-leads";
import { teamOperationRequest } from "@/lib/team-operations";
import {
  formatCompactNumber,
  formatDateTime,
  formatRelativeTime,
} from "@/lib/app-shell/utils";

type TeamLeadsClientProps = {
  initialRows: TeamLeadInboxItem[];
  availableSponsors: TeamLeadAvailableSponsor[];
};

const supervisionFilterOptions = [
  "all",
  "orphaned",
  "stagnant",
  "active",
] as const;

const leadStatusFilterOptions = [
  "all",
  "captured",
  "qualified",
  "assigned",
  "nurturing",
  "won",
  "lost",
] as const;

const filterLabelByValue = {
  all: "Todos",
  orphaned: "Huerfanos",
  stagnant: "Estancados",
  active: "Activos",
  captured: "Capturados",
  qualified: "Calificados",
  assigned: "Asignados",
  nurturing: "En seguimiento",
  won: "Ganados",
  lost: "Perdidos",
} satisfies Record<string, string>;

const buttonClassName =
  "rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-900 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60";

const getLeadLabel = (lead: TeamLeadInboxItem) =>
  lead.fullName ?? lead.phone ?? lead.email ?? "Lead sin nombre";

export function TeamLeadsClient({
  initialRows,
  availableSponsors,
}: TeamLeadsClientProps) {
  const [rows, setRows] = useState(initialRows);
  const [search, setSearch] = useState("");
  const [supervisionFilter, setSupervisionFilter] =
    useState<(typeof supervisionFilterOptions)[number]>("all");
  const [leadStatusFilter, setLeadStatusFilter] =
    useState<(typeof leadStatusFilterOptions)[number]>("all");
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [selectedSponsorId, setSelectedSponsorId] = useState<string>("");
  const [feedback, setFeedback] = useState<{
    tone: "success" | "error";
    message: string;
  } | null>(null);
  const [isPending, startTransition] = useTransition();

  const deferredSearch = useDeferredValue(search.trim().toLowerCase());

  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      const matchesSearch =
        deferredSearch.length === 0 ||
        [
          row.fullName,
          row.phone,
          row.email,
          row.companyName,
          row.funnelName,
          row.domainHost,
          row.sponsor?.displayName,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(deferredSearch);

      const matchesSupervision =
        supervisionFilter === "all" ||
        row.supervisionStatus === supervisionFilter;
      const matchesLeadStatus =
        leadStatusFilter === "all" || row.leadStatus === leadStatusFilter;

      return matchesSearch && matchesSupervision && matchesLeadStatus;
    });
  }, [deferredSearch, leadStatusFilter, rows, supervisionFilter]);

  const selectedLead =
    rows.find((row) => row.id === selectedLeadId) ?? null;
  const candidateSponsors = useMemo(() => {
    if (!selectedLead) {
      return [];
    }

    return availableSponsors.filter(
      (sponsor) => sponsor.id !== selectedLead.sponsor?.id,
    );
  }, [availableSponsors, selectedLead]);

  const orphanedCount = rows.filter(
    (row) => row.supervisionStatus === "orphaned",
  ).length;
  const stagnantCount = rows.filter(
    (row) => row.supervisionStatus === "stagnant",
  ).length;
  const activeCount = rows.filter(
    (row) => row.supervisionStatus === "active",
  ).length;

  const openReassignModal = (leadId: string) => {
    const lead = rows.find((row) => row.id === leadId);

    if (!lead) {
      return;
    }

    const nextCandidates = availableSponsors.filter(
      (sponsor) => sponsor.id !== lead.sponsor?.id,
    );

    setSelectedLeadId(leadId);
    setSelectedSponsorId(nextCandidates[0]?.id ?? "");
    setFeedback(null);
  };

  const closeReassignModal = () => {
    setSelectedLeadId(null);
    setSelectedSponsorId("");
  };

  const updateLead = (leadId: string, updates: Partial<TeamLeadInboxItem>) => {
    setRows((current) =>
      current.map((row) => (row.id === leadId ? { ...row, ...updates } : row)),
    );
  };

  const replaceLead = (leadId: string, nextLead: TeamLeadInboxItem) => {
    setRows((current) =>
      current.map((row) => (row.id === leadId ? nextLead : row)),
    );
  };

  const handleReassign = () => {
    if (!selectedLead || !selectedSponsorId) {
      return;
    }

    const targetSponsor = availableSponsors.find(
      (sponsor) => sponsor.id === selectedSponsorId,
    );

    if (!targetSponsor) {
      return;
    }

    const previousLead = rows.find((row) => row.id === selectedLead.id);

    if (!previousLead) {
      return;
    }

    const optimisticTimestamp = new Date().toISOString();

    setFeedback(null);
    updateLead(selectedLead.id, {
      leadStatus: "assigned",
      assignmentStatus: "assigned",
      supervisionStatus: "stagnant",
      assignedAt: optimisticTimestamp,
      lastActivity: optimisticTimestamp,
      updatedAt: optimisticTimestamp,
      sponsor: {
        id: targetSponsor.id,
        displayName: targetSponsor.displayName,
        availabilityStatus: targetSponsor.availabilityStatus,
        status: targetSponsor.status,
      },
    });

    startTransition(async () => {
      try {
        const response = await teamOperationRequest<TeamLeadReassignResponse>(
          `/team/leads/${selectedLead.id}/reassign`,
          {
            method: "PATCH",
            body: JSON.stringify({
              targetSponsorId: selectedSponsorId,
            }),
          },
        );

        replaceLead(selectedLead.id, response.lead);
        setFeedback({
          tone: "success",
          message: response.automationTriggered
            ? "Lead reasignado y contexto enviado a n8n para el nuevo sponsor."
            : "Lead reasignado correctamente. La tabla ya refleja el nuevo owner.",
        });
        closeReassignModal();
      } catch (error) {
        replaceLead(selectedLead.id, previousLead);
        setFeedback({
          tone: "error",
          message:
            error instanceof Error
              ? error.message
              : "No pudimos reasignar el lead.",
        });
      }
    });
  };

  return (
    <div className="space-y-8">
      <SectionHeader
        eyebrow="Team Admin / Leads"
        title="Bandeja global del equipo"
        description="Vista total para detectar leads huerfanos, handoffs estancados y mover oportunidades entre sponsors activos sin perder el contexto comercial."
        actions={
          <>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar por lead, telefono, sponsor o funnel"
              className="min-w-72 rounded-full border border-slate-300 bg-white px-4 py-2 text-sm outline-none focus:border-slate-950"
            />
            <select
              value={supervisionFilter}
              onChange={(event) =>
                setSupervisionFilter(
                  event.target.value as (typeof supervisionFilterOptions)[number],
                )
              }
              className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm outline-none focus:border-slate-950"
            >
              {supervisionFilterOptions.map((option) => (
                <option key={option} value={option}>
                  {filterLabelByValue[option]}
                </option>
              ))}
            </select>
            <select
              value={leadStatusFilter}
              onChange={(event) =>
                setLeadStatusFilter(
                  event.target.value as (typeof leadStatusFilterOptions)[number],
                )
              }
              className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm outline-none focus:border-slate-950"
            >
              {leadStatusFilterOptions.map((option) => (
                <option key={option} value={option}>
                  {filterLabelByValue[option]}
                </option>
              ))}
            </select>
          </>
        }
      />

      {feedback ? (
        <OperationBanner tone={feedback.tone} message={feedback.message} />
      ) : null}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Panorama total"
          value={formatCompactNumber(rows.length)}
          hint="Todos los leads visibles para supervision del team."
        />
        <KpiCard
          label="Huerfanos"
          value={formatCompactNumber(orphanedCount)}
          hint="Leads sin asignacion activa y listos para rescate."
        />
        <KpiCard
          label="Estancados"
          value={formatCompactNumber(stagnantCount)}
          hint="Asignados pero todavia no aceptados por un sponsor."
        />
        <KpiCard
          label="Sponsors listos"
          value={formatCompactNumber(availableSponsors.length)}
          hint={`${formatCompactNumber(activeCount)} leads hoy ya viven en ownership activo.`}
        />
      </section>

      <DataTable
        columns={[
          {
            key: "lead",
            header: "Lead",
            render: (row) => (
              <div>
                <p className="font-semibold text-slate-950">
                  {row.fullName ?? "Lead sin nombre"}
                </p>
                <p className="text-xs text-slate-500">
                  {row.phone ?? row.email ?? "Sin telefono"}
                </p>
              </div>
            ),
          },
          {
            key: "origin",
            header: "Origen",
            render: (row) => (
              <div>
                <p>{row.funnelName ?? "Sin funnel"}</p>
                <p className="text-xs text-slate-500">
                  {row.domainHost ?? "Host pendiente"}
                  {row.publicationPath ? ` · ${row.publicationPath}` : ""}
                </p>
              </div>
            ),
          },
          {
            key: "owner",
            header: "Sponsor actual",
            render: (row) => (
              <div>
                <p>{row.sponsor?.displayName ?? "Sin owner"}</p>
                <p className="text-xs text-slate-500">
                  {row.sponsor
                    ? formatDateTime(row.assignedAt)
                    : "Sin asignacion activa"}
                </p>
              </div>
            ),
          },
          {
            key: "status",
            header: "Estado",
            render: (row) => (
              <div className="flex flex-wrap gap-2">
                <StatusBadge value={row.supervisionStatus} />
                <StatusBadge value={row.leadStatus} />
                {row.assignmentStatus ? (
                  <StatusBadge value={row.assignmentStatus} />
                ) : null}
              </div>
            ),
          },
          {
            key: "activity",
            header: "Ultima actividad",
            render: (row) => (
              <div>
                <p>{formatRelativeTime(row.lastActivity)}</p>
                <p className="text-xs text-slate-500">
                  {formatDateTime(row.lastActivity)}
                </p>
              </div>
            ),
          },
          {
            key: "assignedAt",
            header: "Tiempo desde asignacion",
            render: (row) => (
              <div>
                <p>
                  {row.assignedAt
                    ? formatRelativeTime(row.assignedAt)
                    : "Sin asignar"}
                </p>
                <p className="text-xs text-slate-500">
                  {row.assignedAt ? formatDateTime(row.assignedAt) : "Pendiente"}
                </p>
              </div>
            ),
          },
          {
            key: "action",
            header: "Accion",
            render: (row) => (
              <button
                type="button"
                onClick={() => openReassignModal(row.id)}
                disabled={
                  isPending ||
                  availableSponsors.filter(
                    (sponsor) => sponsor.id !== row.sponsor?.id,
                  ).length === 0
                }
                className={buttonClassName}
              >
                Reasignar
              </button>
            ),
          },
        ]}
        rows={filteredRows}
        emptyTitle="Sin leads para mostrar"
        emptyDescription="Cuando el team capture oportunidades o necesite rescates manuales, esta bandeja global mostrara el ownership y el pulso operativo completo."
      />

      {selectedLead ? (
        <ModalShell
          title={`Reasignar ${getLeadLabel(selectedLead)}`}
          description="Selecciona un sponsor disponible. Al confirmar, cerramos el handoff actual, asignamos el nuevo owner y disparamos el upsert de contexto para WhatsApp."
          onClose={closeReassignModal}
        >
          <div className="space-y-5">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl bg-slate-50 p-4 text-sm">
                <p className="text-slate-500">Owner actual</p>
                <p className="mt-2 font-medium text-slate-950">
                  {selectedLead.sponsor?.displayName ?? "Sin owner"}
                </p>
                <p className="mt-1 text-slate-700">
                  {selectedLead.assignedAt
                    ? `Asignado ${formatRelativeTime(selectedLead.assignedAt)}`
                    : "Lead huerfano"}
                </p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4 text-sm">
                <p className="text-slate-500">Contexto</p>
                <p className="mt-2 font-medium text-slate-950">
                  {selectedLead.funnelName ?? "Sin funnel"}
                </p>
                <p className="mt-1 text-slate-700">
                  {selectedLead.domainHost ?? "Host pendiente"}
                  {selectedLead.publicationPath
                    ? ` · ${selectedLead.publicationPath}`
                    : ""}
                </p>
              </div>
            </div>

            {candidateSponsors.length > 0 ? (
              <label className="block">
                <span className="text-sm font-semibold text-slate-900">
                  Nuevo sponsor
                </span>
                <select
                  value={selectedSponsorId}
                  onChange={(event) => setSelectedSponsorId(event.target.value)}
                  className="mt-3 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none focus:border-slate-950"
                >
                  {candidateSponsors.map((sponsor) => (
                    <option key={sponsor.id} value={sponsor.id}>
                      {sponsor.displayName}
                      {sponsor.phone ? ` · ${sponsor.phone}` : ""}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-4 text-sm text-slate-600">
                No hay sponsors activos y disponibles distintos al owner actual.
              </div>
            )}

            <div className="flex flex-wrap justify-end gap-3">
              <button
                type="button"
                onClick={closeReassignModal}
                className={buttonClassName}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleReassign}
                disabled={isPending || !selectedSponsorId}
                className="rounded-full border border-slate-950 bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isPending ? "Reasignando..." : "Confirmar reasignacion"}
              </button>
            </div>
          </div>
        </ModalShell>
      ) : null}
    </div>
  );
}
