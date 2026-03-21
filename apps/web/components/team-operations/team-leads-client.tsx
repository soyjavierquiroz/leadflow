"use client";

import { useMemo, useState } from "react";
import { DataTable } from "@/components/app-shell/data-table";
import { KpiCard } from "@/components/app-shell/kpi-card";
import { SectionHeader } from "@/components/app-shell/section-header";
import { StatusBadge } from "@/components/app-shell/status-badge";
import type { LeadView } from "@/lib/app-shell/types";
import { formatCompactNumber, formatDateTime } from "@/lib/app-shell/utils";

type TeamLeadsClientProps = {
  initialRows: LeadView[];
};

export function TeamLeadsClient({ initialRows }: TeamLeadsClientProps) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");

  const rows = useMemo(() => {
    return initialRows.filter((row) => {
      const matchesStatus = status === "all" ? true : row.status === status;
      const haystack = [
        row.fullName,
        row.email,
        row.phone,
        row.companyName,
        row.funnelName,
        row.sponsorName,
        row.domainHost,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const matchesSearch =
        search.trim().length === 0
          ? true
          : haystack.includes(search.trim().toLowerCase());

      return matchesStatus && matchesSearch;
    });
  }, [initialRows, search, status]);

  return (
    <div className="space-y-8">
      <SectionHeader
        eyebrow="Team Admin / Leads"
        title="Pipeline del team"
        description="Listado operativo con filtros básicos para que el team admin pueda revisar rápidamente qué está entrando desde el runtime y cómo va el assignment."
        actions={
          <>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar lead, funnel, sponsor..."
              className="min-w-72 rounded-full border border-slate-300 bg-white px-4 py-2 text-sm outline-none focus:border-slate-950"
            />
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value)}
              className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm outline-none focus:border-slate-950"
            >
              <option value="all">Todos</option>
              <option value="captured">Captured</option>
              <option value="assigned">Assigned</option>
              <option value="qualified">Qualified</option>
              <option value="nurturing">Nurturing</option>
              <option value="won">Won</option>
              <option value="lost">Lost</option>
            </select>
          </>
        }
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Leads"
          value={formatCompactNumber(rows.length)}
          hint="Prospectos capturados por el runtime público o cargados por el seed."
        />
        <KpiCard
          label="Assigned"
          value={formatCompactNumber(rows.filter((item) => item.status === "assigned").length)}
          hint="Leads ya puestos en manos de un sponsor."
        />
        <KpiCard
          label="Captured"
          value={formatCompactNumber(rows.filter((item) => item.status === "captured").length)}
          hint="Leads que todavía no completan un assignment activo."
        />
        <KpiCard
          label="Con sponsor"
          value={formatCompactNumber(rows.filter((item) => item.sponsorId).length)}
          hint="Visibilidad directa del ownership comercial actual."
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
                  {row.companyName ?? row.email ?? row.phone ?? "Sin contacto"}
                </p>
              </div>
            ),
          },
          {
            key: "funnel",
            header: "Funnel / Publicación",
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
            key: "assignment",
            header: "Sponsor",
            render: (row) => (
              <div>
                <p>{row.sponsorName ?? "Pendiente"}</p>
                <p className="text-xs text-slate-500">
                  {formatDateTime(row.assignedAt)}
                </p>
              </div>
            ),
          },
          {
            key: "status",
            header: "Estado lead",
            render: (row) => <StatusBadge value={row.status} />,
          },
          {
            key: "assignmentStatus",
            header: "Estado assignment",
            render: (row) => <StatusBadge value={row.assignmentStatus} />,
          },
        ]}
        rows={rows}
        emptyTitle="Sin leads para el team"
        emptyDescription="Cuando se capturen más leads desde el runtime público, esta vista los mostrará con su trazabilidad básica."
      />
    </div>
  );
}
