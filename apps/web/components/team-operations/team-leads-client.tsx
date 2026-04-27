"use client";

import Link from "next/link";
import {
  useDeferredValue,
  useMemo,
  useState,
  useTransition,
} from "react";
import { DataTable } from "@/components/app-shell/data-table";
import { KpiCard } from "@/components/app-shell/kpi-card";
import { LeadSourceBadge } from "@/components/app-shell/lead-source-badge";
import { PremiumSelect } from "@/components/app-shell/premium-select";
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

const filterLabelByValue = {
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
  "rounded-full border border-app-border bg-app-card px-3 py-1.5 text-xs font-semibold text-app-text transition hover:border-app-border-strong hover:bg-app-surface-muted disabled:cursor-not-allowed disabled:opacity-60";

const filterControlClassName =
  "w-full rounded-full border border-app-border bg-app-card px-4 py-2 text-sm text-app-text outline-none transition placeholder:text-app-text-soft focus:border-app-border-strong focus:ring-2 focus:ring-app-accent-soft md:w-auto [&>option]:bg-app-card [&>option]:text-app-text";

const modalSelectClassName =
  "mt-3 w-full rounded-2xl border border-app-border bg-app-card px-4 py-3 text-sm text-app-text outline-none transition focus:border-app-border-strong focus:ring-2 focus:ring-app-accent-soft [&>option]:bg-app-card [&>option]:text-app-text";

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
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all");
  const [sponsorFilter, setSponsorFilter] = useState("all");
  const [openSelectId, setOpenSelectId] = useState<string | null>(null);
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
          row.originAdWheelName,
          row.trafficLayer === "PAID_WHEEL"
            ? "campaña pagada publicidad"
            : "organico directo",
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
      const matchesSponsor =
        sponsorFilter === "all" ||
        (sponsorFilter === "unassigned"
          ? !row.sponsor
          : row.sponsor?.id === sponsorFilter);
      const matchesSource =
        sourceFilter === "all" ||
        (sourceFilter === "paid"
          ? row.trafficLayer === "PAID_WHEEL"
          : row.trafficLayer !== "PAID_WHEEL");

      return (
        matchesSearch &&
        matchesSupervision &&
        matchesLeadStatus &&
        matchesSource &&
        matchesSponsor
      );
    });
  }, [
    deferredSearch,
    leadStatusFilter,
    rows,
    sourceFilter,
    sponsorFilter,
    supervisionFilter,
  ]);

  const sponsorFilterOptions = useMemo(() => {
    const sponsorById = new Map<string, string>();

    rows.forEach((row) => {
      if (row.sponsor) {
        sponsorById.set(row.sponsor.id, row.sponsor.displayName);
      }
    });

    availableSponsors.forEach((sponsor) => {
      if (!sponsorById.has(sponsor.id)) {
        sponsorById.set(sponsor.id, sponsor.displayName);
      }
    });

    return Array.from(sponsorById, ([id, displayName]) => ({
      id,
      displayName,
    })).sort((first, second) =>
      first.displayName.localeCompare(second.displayName),
    );
  }, [availableSponsors, rows]);

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
    <div className="w-full min-w-0 space-y-8">
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
              className={`${filterControlClassName} min-w-72`}
            />
            <select
              value={supervisionFilter}
              onChange={(event) =>
                setSupervisionFilter(
                  event.target.value as (typeof supervisionFilterOptions)[number],
                )
              }
              aria-label="Estado operativo"
              className={filterControlClassName}
            >
              {supervisionFilterOptions.map((option) => (
                <option key={option} value={option}>
                  {option === "all"
                    ? "Estado operativo"
                    : filterLabelByValue[option]}
                </option>
              ))}
            </select>
            <PremiumSelect
              id="team-lead-source-filter"
              value={sourceFilter}
              placeholder="Fuente"
              options={sourceFilterOptions}
              open={openSelectId === "source"}
              onOpenChange={(open) => setOpenSelectId(open ? "source" : null)}
              onValueChange={(value) => setSourceFilter(value as SourceFilter)}
              className="w-full md:w-60"
            />
            <select
              value={leadStatusFilter}
              onChange={(event) =>
                setLeadStatusFilter(
                  event.target.value as (typeof leadStatusFilterOptions)[number],
                )
              }
              aria-label="Estado del lead"
              className={filterControlClassName}
            >
              {leadStatusFilterOptions.map((option) => (
                <option key={option} value={option}>
                  {option === "all"
                    ? "Estado del lead"
                    : filterLabelByValue[option]}
                </option>
              ))}
            </select>
            <select
              value={sponsorFilter}
              onChange={(event) => setSponsorFilter(event.target.value)}
              aria-label="Sponsor asignado"
              className={filterControlClassName}
            >
              <option value="all">Sponsor asignado</option>
              <option value="unassigned">Sin sponsor</option>
              {sponsorFilterOptions.map((sponsor) => (
                <option key={sponsor.id} value={sponsor.id}>
                  {sponsor.displayName}
                </option>
              ))}
            </select>
          </>
        }
      />

      {feedback ? (
        <OperationBanner tone={feedback.tone} message={feedback.message} />
      ) : null}

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
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
                <p className="font-semibold text-app-text">
                  {row.fullName ?? "Lead sin nombre"}
                </p>
                <p className="text-xs text-app-text-soft">
                  {row.phone ?? row.email ?? "Sin telefono"}
                </p>
                <div className="mt-3">
                  <LeadSourceBadge
                    trafficLayer={row.trafficLayer}
                    originAdWheelName={row.originAdWheelName}
                  />
                </div>
              </div>
            ),
          },
          {
            key: "origin",
            header: "Origen",
            render: (row) => (
              <div>
                <p>{row.funnelName ?? "Sin funnel"}</p>
                <p className="text-xs text-app-text-soft">
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
                <p className="text-xs text-app-text-soft">
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
                <p className="text-xs text-app-text-soft">
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
                <p className="text-xs text-app-text-soft">
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
        emptyEyebrow="Bandeja lista"
        emptyTitle="Sin leads para mostrar"
        emptyDescription="Cuando el team capture oportunidades o necesite rescates manuales, esta bandeja global mostrara el ownership y el pulso operativo completo."
        emptyAction={
          <Link href="/team/publications/new-vsl" className={buttonClassName}>
            Crear mi primer funnel
          </Link>
        }
      />

      {selectedLead ? (
        <ModalShell
          title={`Reasignar ${getLeadLabel(selectedLead)}`}
          description="Selecciona un sponsor disponible. Al confirmar, cerramos el handoff actual, asignamos el nuevo owner y disparamos el upsert de contexto para WhatsApp."
          onClose={closeReassignModal}
        >
          <div className="space-y-5">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl bg-app-surface-muted p-4 text-sm">
                <p className="text-app-text-soft">Owner actual</p>
                <p className="mt-2 font-medium text-app-text">
                  {selectedLead.sponsor?.displayName ?? "Sin owner"}
                </p>
                <p className="mt-1 text-app-text-muted">
                  {selectedLead.assignedAt
                    ? `Asignado ${formatRelativeTime(selectedLead.assignedAt)}`
                    : "Lead huerfano"}
                </p>
              </div>
              <div className="rounded-2xl bg-app-surface-muted p-4 text-sm">
                <p className="text-app-text-soft">Contexto</p>
                <p className="mt-2 font-medium text-app-text">
                  {selectedLead.funnelName ?? "Sin funnel"}
                </p>
                <p className="mt-1 text-app-text-muted">
                  {selectedLead.domainHost ?? "Host pendiente"}
                  {selectedLead.publicationPath
                    ? ` · ${selectedLead.publicationPath}`
                    : ""}
                </p>
              </div>
            </div>

            {candidateSponsors.length > 0 ? (
              <label className="block">
                <span className="text-sm font-semibold text-app-text">
                  Nuevo sponsor
                </span>
                <select
                  value={selectedSponsorId}
                  onChange={(event) => setSelectedSponsorId(event.target.value)}
                  aria-label="Nuevo sponsor asignado"
                  className={modalSelectClassName}
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
              <div className="rounded-2xl border border-dashed border-app-border bg-app-surface-muted px-4 py-4 text-sm text-app-text-muted">
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
                className="rounded-full border border-app-text bg-app-text px-4 py-2 text-sm font-semibold text-app-bg transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
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
