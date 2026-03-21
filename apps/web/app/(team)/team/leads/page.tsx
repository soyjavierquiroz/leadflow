import { DataTable } from "@/components/app-shell/data-table";
import { KpiCard } from "@/components/app-shell/kpi-card";
import { SectionHeader } from "@/components/app-shell/section-header";
import { StatusBadge } from "@/components/app-shell/status-badge";
import { getAppShellSnapshot } from "@/lib/app-shell/data";
import { formatCompactNumber, formatDateTime } from "@/lib/app-shell/utils";

export default async function TeamLeadsPage() {
  const data = await getAppShellSnapshot();
  const rows = data.leadViews.filter((item) => item.teamId === data.currentTeam.id);

  return (
    <div className="space-y-8">
      <SectionHeader
        eyebrow="Team Admin / Leads"
        title="Pipeline del team"
        description="Listado inicial de leads con unión básica a publicación, sponsor asignado y estado de assignment."
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
